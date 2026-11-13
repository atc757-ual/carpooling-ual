import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import { CampusParkingsService } from '../places/campus-parkings.service';
import { TripPickup } from './entities/trip-pickup.entity';
import { TripRoute } from './entities/trip-route.entity';
import { TripStop } from './entities/trip-stop.entity';
import type { Trip, TripPickupMode } from './entities/trip.entity';
import { InvalidStopsError } from './errors/invalid-stops.error';
import { StopsExceedDetourError } from './errors/stops-exceed-detour.error';
import { orderPickups, stopPickupOffsets, usedDetourMin } from './pickup-plan';
import type { RoutePlan } from './route-plan';
import { CAMPUS_RADIUS_M } from './trip-candidates.service';
import { TripRoutesService } from './trip-routes.service';
import { MAX_TRIP_STOPS, MINUTE_MS } from './trip-timing';

export interface StopInput {
  name: string;
  location: Point;
}

export interface PlannedStop extends StopInput {
  position: number;
  etaOffsetMin: number;
}

// La ruta con la que se publica un viaje: en puntos, la que pasa por las
// paradas (y la directa, para medir el desvío)
export interface PublishedRoute {
  route: RoutePlan;
  directDurationMin: number;
  stops: PlannedStop[];
}

// Una parada con la hora a la que pasa el conductor (con el tiempo de las
// paradas anteriores en las que sube alguien)
export interface TripStopView {
  id: string;
  position: number;
  name: string;
  location: Point;
  estimatedAt: Date;
}

// Recogida en puntos (docs/diseno-modos-recogida-y-vuelta.md, §4.2): las
// paradas de un viaje hacia el campus, que elige el conductor al publicar
@Injectable()
export class TripStopsService {
  constructor(
    @InjectRepository(TripStop)
    private readonly stopsRepository: Repository<TripStop>,
    private readonly tripRoutes: TripRoutesService,
    private readonly campusParkings: CampusParkingsService,
  ) {}

  // Antes de la transacción (OSRM). En ruta, la directa y sin paradas; en
  // puntos, ordena las paradas a lo largo de la ruta directa, pide la ruta
  // que pasa por todas y comprueba que su desvío cabe en el presupuesto
  async planRoute(
    trip: {
      origin: Point;
      destination: Point;
      pickupMode?: TripPickupMode;
      maxDetourM?: number | null;
      stops?: readonly StopInput[];
    },
    maxDetourMin: number,
  ): Promise<PublishedRoute> {
    const direct = await this.tripRoutes.plan(trip.origin, trip.destination);
    if (trip.pickupMode !== 'stops') {
      if (trip.stops !== undefined && trip.stops.length > 0) {
        throw new InvalidStopsError('stops need pickupMode stops');
      }
      return {
        route: direct,
        directDurationMin: direct.durationMin,
        stops: [],
      };
    }
    await this.assertStops(trip);
    const ordered = orderPickups(
      direct.geometry,
      (trip.stops ?? []).map((stop, index) => ({ ...stop, id: String(index) })),
    );
    const { route, legsMin } = await this.tripRoutes.planVia(
      trip.origin,
      ordered.map(({ location }) => location),
      trip.destination,
    );
    const detourMin = Math.round(
      usedDetourMin({
        durationMin: route.durationMin,
        directDurationMin: direct.durationMin,
        stops: 0,
      }),
    );
    if (detourMin > maxDetourMin) {
      throw new StopsExceedDetourError(detourMin, maxDetourMin);
    }
    let elapsedMin = 0;
    return {
      route,
      directDurationMin: direct.durationMin,
      stops: ordered.map(({ name, location }, position) => {
        elapsedMin += legsMin[position];
        return {
          name,
          location,
          position,
          etaOffsetMin: Math.round(elapsedMin),
        };
      }),
    };
  }

  // Con el viaje que se guarda, en su transacción
  async save(
    manager: EntityManager,
    tripId: string,
    stops: readonly PlannedStop[],
  ): Promise<void> {
    if (stops.length > 0) {
      await manager.save(
        stops.map((stop) => manager.create(TripStop, { tripId, ...stop })),
      );
    }
  }

  // Al modificar un viaje con paradas: las paradas dependen de la ruta (se
  // cancela y se vuelve a publicar para moverlo), los metros solo son de la
  // recogida en ruta y el desvío nuevo tiene que cubrir el que ya se gasta
  async assertChangesFit(
    manager: EntityManager,
    trip: Pick<Trip, 'id' | 'pickupMode'>,
    changes: {
      origin?: Point;
      destination?: Point;
      maxDetourM?: number | null;
      maxDetourMin?: number;
    },
  ): Promise<void> {
    if (trip.pickupMode !== 'stops') {
      return;
    }
    if (changes.origin !== undefined || changes.destination !== undefined) {
      throw new InvalidStopsError(
        'the stops depend on the route: cancel the trip and publish it again',
      );
    }
    if (changes.maxDetourM !== undefined) {
      throw new InvalidStopsError('maxDetourM only applies on the route');
    }
    if (changes.maxDetourMin === undefined) {
      return;
    }
    const [route, pickups] = await Promise.all([
      manager.findOneByOrFail(TripRoute, { tripId: trip.id }),
      manager.find(TripPickup, { where: { tripId: trip.id } }),
    ]);
    const usedMin = Math.round(
      usedDetourMin({
        durationMin: route.durationMin,
        directDurationMin: route.directDurationMin,
        stops: new Set(pickups.map(({ stopId }) => stopId)).size,
      }),
    );
    if (usedMin > changes.maxDetourMin) {
      throw new StopsExceedDetourError(usedMin, changes.maxDetourMin);
    }
  }

  // Las paradas de varios viajes, en dos consultas, con su hora estimada
  async getForTrips(
    trips: readonly Pick<Trip, 'id' | 'departureAt' | 'pickupMode'>[],
  ): Promise<Map<string, TripStopView[]>> {
    const withStops = trips.filter(({ pickupMode }) => pickupMode === 'stops');
    const views = new Map<string, TripStopView[]>(
      trips.map(({ id }) => [id, []]),
    );
    if (withStops.length === 0) {
      return views;
    }
    const tripIds = withStops.map(({ id }) => id);
    const [stops, pickups] = await Promise.all([
      this.stopsRepository.find({
        where: { tripId: In(tripIds) },
        order: { position: 'ASC' },
      }),
      this.stopsRepository.manager.find(TripPickup, {
        where: { tripId: In(tripIds) },
      }),
    ]);
    for (const trip of withStops) {
      const tripStops = stops.filter(({ tripId }) => tripId === trip.id);
      const occupied = new Set(
        pickups
          .filter(({ tripId, stopId }) => tripId === trip.id && stopId !== null)
          .map(({ stopId }) => stopId as string),
      );
      const offsets = stopPickupOffsets(tripStops, occupied);
      views.set(
        trip.id,
        tripStops.map(({ id, position, name, location }) => ({
          id,
          position,
          name,
          location,
          estimatedAt: new Date(
            trip.departureAt.getTime() + (offsets.get(id) ?? 0) * MINUTE_MS,
          ),
        })),
      );
    }
    return views;
  }

  // Una parada de un viaje (al pedir plaza en ella), o null si no es suya
  findOne(tripId: string, stopId: string): Promise<TripStop | null> {
    return this.stopsRepository.findOneBy({ tripId, id: stopId });
  }

  private async assertStops(trip: {
    destination: Point;
    maxDetourM?: number | null;
    stops?: readonly StopInput[];
  }): Promise<void> {
    const count = trip.stops?.length ?? 0;
    if (count < 1 || count > MAX_TRIP_STOPS) {
      throw new InvalidStopsError(`from 1 to ${MAX_TRIP_STOPS} stops`);
    }
    if (trip.maxDetourM !== undefined && trip.maxDetourM !== null) {
      throw new InvalidStopsError('maxDetourM only applies on the route');
    }
    const isToCampus = await this.campusParkings.isNearAny(
      trip.destination,
      CAMPUS_RADIUS_M,
    );
    if (!isToCampus) {
      throw new InvalidStopsError('stops only on the way to the campus');
    }
  }
}
