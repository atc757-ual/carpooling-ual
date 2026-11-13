import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import type { LineString, Point } from 'typeorm';
import { TripPickup } from './entities/trip-pickup.entity';
import { TripRoute } from './entities/trip-route.entity';
import { TripStop } from './entities/trip-stop.entity';
import type { Trip } from './entities/trip.entity';
import { DetourBudgetExceededError } from './errors/detour-budget-exceeded.error';
import { TripPickupsChangedError } from './errors/trip-pickups-changed.error';
import {
  fitsBudget,
  orderPickups,
  pickupOffsets,
  stopCount,
  usedDetourMin,
} from './pickup-plan';
import type { PickupPoint } from './pickup-plan';
import { estimateRouteVia } from './route-plan';
import type { RoutePlan } from './route-plan';
import { planStopPickups } from './stop-pickups';
import { TripRoutesService } from './trip-routes.service';
import { MINUTE_MS } from './trip-timing';

export type PickupTrip = Pick<
  Trip,
  | 'id'
  | 'origin'
  | 'destination'
  | 'departureAt'
  | 'maxDetourMin'
  | 'pickupMode'
>;

export interface PlannedPickup {
  requestId: string;
  location: Point;
  // La parada en la que sube (recogida en puntos); null en ruta
  stopId: string | null;
  position: number;
  etaOffsetMin: number;
}

// La recogida que se añade: en puntos, con su parada
export type NewPickup = PickupPoint & { stopId?: string | null };

// La ruta de un viaje con sus recogidas, calculada fuera de la transacción.
// previousRequestIds son las recogidas de las que partió: al aplicarla se
// comprueba que siguen siendo esas
export interface PickupPlan {
  tripId: string;
  previousRequestIds: string[];
  isAddition: boolean;
  route: RoutePlan;
  directDurationMin: number;
  pickups: PlannedPickup[];
  usedDetourMin: number;
}

// Recogidas de los viajes (presupuesto total de desvío, reunión del 12/11):
// dónde recoge el conductor a cada pasajero aceptado, la ruta que pasa por
// todos y a qué hora llega a cada uno. Se planifica fuera de la transacción
// (OSRM) y se aplica dentro, con el viaje bloqueado
@Injectable()
export class TripPickupsService {
  constructor(
    @InjectRepository(TripPickup)
    private readonly pickupsRepository: Repository<TripPickup>,
    @InjectRepository(TripRoute)
    private readonly routesRepository: Repository<TripRoute>,
    @InjectRepository(TripStop)
    private readonly stopsRepository: Repository<TripStop>,
    private readonly tripRoutes: TripRoutesService,
  ) {}

  // La ruta con una recogida más (added) o una menos (removedRequestId)
  async planWith(
    trip: PickupTrip,
    added: NewPickup | null,
    removedRequestId: string | null,
  ): Promise<PickupPlan> {
    const [current, savedRoute] = await Promise.all([
      this.pickupsRepository.find({ where: { tripId: trip.id } }),
      this.routesRepository.findOneBy({ tripId: trip.id }),
    ]);
    const kept = current
      .filter(({ requestId }) => requestId !== removedRequestId)
      .map(({ requestId, location, stopId }) => ({
        id: requestId,
        location,
        stopId,
      }));
    if (trip.pickupMode === 'stops') {
      const points = added
        ? [...kept, { ...added, stopId: added.stopId ?? null }]
        : kept;
      const [stops, route] = await Promise.all([
        this.stopsRepository.find({ where: { tripId: trip.id } }),
        this.tripRoutes.getForTrip(trip),
      ]);
      return {
        tripId: trip.id,
        previousRequestIds: sortedRequestIds(current),
        isAddition: added !== null,
        route: toRoutePlan(route),
        directDurationMin: route.directDurationMin,
        ...planStopPickups({ tripId: trip.id, stops, points, route }),
      };
    }
    const geometry: LineString = savedRoute?.geometry ?? {
      type: 'LineString',
      coordinates: [trip.origin.coordinates, trip.destination.coordinates],
    };
    const ordered = orderPickups(geometry, added ? [...kept, added] : kept);
    const { route, legsMin } = await this.planRoute(trip, ordered);
    const offsets = pickupOffsets(legsMin.slice(0, ordered.length));
    const directDurationMin =
      savedRoute?.directDurationMin ?? route.durationMin;
    return {
      tripId: trip.id,
      previousRequestIds: sortedRequestIds(current),
      isAddition: added !== null,
      route,
      directDurationMin,
      pickups: ordered.map(({ id, location }, position) => ({
        requestId: id,
        location,
        stopId: null,
        position,
        etaOffsetMin: Math.round(offsets[position]),
      })),
      usedDetourMin: usedDetourMin({
        durationMin: route.durationMin,
        directDurationMin,
        stops: stopCount(trip.origin, ordered),
      }),
    };
  }

  // Guarda el plan con el viaje ya bloqueado: si otra plaza cambió las
  // recogidas mientras tanto, hay que reintentar; una recogida nueva tiene que
  // caber en el presupuesto (quitar una solo devuelve tiempo). Devuelve la
  // hora de recogida de cada solicitud
  async apply(
    manager: EntityManager,
    trip: PickupTrip,
    plan: PickupPlan,
  ): Promise<Map<string, Date>> {
    const saved = await manager.find(TripPickup, {
      where: { tripId: trip.id },
    });
    if (sortedRequestIds(saved).join() !== plan.previousRequestIds.join()) {
      throw new TripPickupsChangedError(trip.id);
    }
    if (plan.isAddition && !fitsBudget(plan.usedDetourMin, trip.maxDetourMin)) {
      throw new DetourBudgetExceededError(trip.id, trip.maxDetourMin);
    }
    return this.save(manager, trip, plan);
  }

  // Quita la recogida de una plaza que se suelta (el pasajero cancela antes
  // del viaje), dentro de su transacción y SIN OSRM: la ruta por las que
  // quedan se estima y se marca para volver a pedirla (getForTrip). Devuelve
  // las horas nuevas de los demás, o null si la plaza no tenía recogida
  async remove(
    manager: EntityManager,
    trip: PickupTrip,
    requestId: string,
  ): Promise<Map<string, Date> | null> {
    const [saved, savedRoute] = await Promise.all([
      manager.find(TripPickup, {
        where: { tripId: trip.id },
        order: { position: 'ASC' },
      }),
      manager.findOneBy(TripRoute, { tripId: trip.id }),
    ]);
    if (!saved.some((pickup) => pickup.requestId === requestId)) {
      return null;
    }
    const kept = saved.filter((pickup) => pickup.requestId !== requestId);
    if (trip.pickupMode === 'stops' && savedRoute !== null) {
      const stops = await manager.find(TripStop, {
        where: { tripId: trip.id },
      });
      return this.save(manager, trip, {
        route: toRoutePlan(savedRoute),
        directDurationMin: savedRoute.directDurationMin,
        ...planStopPickups({
          tripId: trip.id,
          stops,
          route: savedRoute,
          points: kept.map(({ requestId: id, location, stopId }) => ({
            id,
            location,
            stopId,
          })),
        }),
      });
    }
    const { route, legsMin } = estimateRouteVia([
      trip.origin,
      ...kept.map(({ location }) => location),
      trip.destination,
    ]);
    const offsets = pickupOffsets(legsMin.slice(0, kept.length));
    return this.save(manager, trip, {
      route,
      directDurationMin: savedRoute?.directDurationMin ?? route.durationMin,
      pickups: kept.map(({ requestId: keptId, location }, position) => ({
        requestId: keptId,
        location,
        stopId: null,
        position,
        etaOffsetMin: Math.round(offsets[position]),
      })),
    });
  }

  private async save(
    manager: EntityManager,
    trip: PickupTrip,
    plan: Pick<PickupPlan, 'route' | 'directDurationMin' | 'pickups'>,
  ): Promise<Map<string, Date>> {
    await manager.delete(TripPickup, { tripId: trip.id });
    if (plan.pickups.length > 0) {
      await manager.save(
        plan.pickups.map((pickup) =>
          manager.create(TripPickup, { tripId: trip.id, ...pickup }),
        ),
      );
    }
    await this.tripRoutes.save(
      manager,
      trip.id,
      plan.route,
      plan.directDurationMin,
    );
    return new Map(
      plan.pickups.map(({ requestId, etaOffsetMin }) => [
        requestId,
        new Date(trip.departureAt.getTime() + etaOffsetMin * MINUTE_MS),
      ]),
    );
  }

  private planRoute(
    trip: PickupTrip,
    ordered: readonly PickupPoint[],
  ): Promise<{ route: RoutePlan; legsMin: number[] }> {
    if (ordered.length === 0) {
      return this.tripRoutes
        .plan(trip.origin, trip.destination)
        .then((route) => ({ route, legsMin: [route.durationMin] }));
    }
    return this.tripRoutes.planVia(
      trip.origin,
      ordered.map(({ location }) => location),
      trip.destination,
    );
  }
}

function sortedRequestIds(pickups: readonly TripPickup[]): string[] {
  return pickups
    .map(({ requestId }) => requestId)
    .sort((a, b) => a.localeCompare(b));
}

function toRoutePlan({
  distanceKm,
  durationMin,
  geometry,
  source,
}: TripRoute): RoutePlan {
  return { distanceKm, durationMin, geometry, source };
}
