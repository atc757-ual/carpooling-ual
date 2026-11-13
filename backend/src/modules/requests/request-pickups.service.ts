import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { Point } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import { TripPickupsService } from '../trips/trip-pickups.service';
import type { PickupPlan } from '../trips/trip-pickups.service';
import { StopNotInTripError } from '../trips/errors/stop-not-in-trip.error';
import { StopRequiredError } from '../trips/errors/stop-required.error';
import { MINUTE_MS } from '../trips/trip-timing';
import { TripStopsService } from '../trips/trip-stops.service';
import { InvalidRequestPickupError } from './errors/invalid-request-pickup.error';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';

export interface RequestPickupContext {
  direction: 'to-campus' | 'from-campus';
  pickupLocation?: Point;
  pickupName?: string;
  // Recogida en puntos: la parada elegida
  stopId?: string;
}

// Dónde y a qué hora le recogerían, al pedir plaza
export interface ResolvedPickup {
  location: Point;
  name: string;
  stopId: string | null;
  pickupAt: Date;
}

// Id provisional de la solicitud que aún no existe, al estimar su hora
const NEW_REQUEST_ID = 'new-request';

// Mientras se puede soltar la plaza sin que el viaje haya empezado, su
// recogida se quita y las horas de los demás se recalculan
const STATUSES_WITH_PICKUPS = new Set<Trip['status']>([
  'published',
  'confirmed',
]);

// Las recogidas de las plazas aceptadas (presupuesto total de desvío). Solo
// hacia el campus y con un punto de recogida: al volver todos suben en el
// campus y las bajadas llegarán con el «modo retorno». El viaje es de otro
// módulo: todo pasa por TripPickupsService con el manager de la transacción
@Injectable()
export class RequestPickupsService implements OnModuleInit {
  constructor(
    private readonly tripPickups: TripPickupsService,
    private readonly tripStops: TripStopsService,
    private readonly changes: RequestChangesRecorder,
  ) {}

  // Al pedir plaza (antes de la transacción). Al volver, todos suben en la
  // salida del conductor (el campus). Hacia el campus, en su parada si el
  // viaje recoge en puntos y, si no, en el punto del pasajero
  async resolve(
    trip: Trip,
    context: RequestPickupContext,
  ): Promise<ResolvedPickup> {
    const atStops =
      context.direction === 'to-campus' && trip.pickupMode === 'stops';
    if (!atStops && context.stopId !== undefined) {
      throw new StopNotInTripError(trip.id, context.stopId);
    }
    if (context.direction === 'from-campus') {
      return {
        location: trip.origin,
        name: trip.originName ?? 'Punto de salida del conductor',
        stopId: null,
        pickupAt: trip.departureAt,
      };
    }
    if (atStops) {
      return this.resolveStop(trip, context.stopId);
    }
    if (!context.pickupLocation || !context.pickupName) {
      throw new InvalidRequestPickupError();
    }
    const location = context.pickupLocation;
    // Si recoge en su misma salida, sale ya
    return {
      location,
      name: context.pickupName,
      stopId: null,
      pickupAt: samePoint(trip.origin, location)
        ? trip.departureAt
        : await this.estimatePickupAt(trip, location),
    };
  }

  private async resolveStop(
    trip: Trip,
    stopId: string | undefined,
  ): Promise<ResolvedPickup> {
    if (stopId === undefined) {
      throw new StopRequiredError(trip.id);
    }
    const stop = await this.tripStops.findOne(trip.id, stopId);
    if (stop === null) {
      throw new StopNotInTripError(trip.id, stopId);
    }
    return {
      location: stop.location,
      name: stop.name,
      stopId: stop.id,
      pickupAt: await this.estimatePickupAt(trip, stop.location, stop.id),
    };
  }

  onModuleInit(): void {
    this.changes.onRequestChanged(async (manager, change) => {
      if (
        change.type === 'request.cancelled' &&
        STATUSES_WITH_PICKUPS.has(change.trip.status)
      ) {
        const times = await this.tripPickups.remove(
          manager,
          change.trip,
          change.request.id,
        );
        if (times !== null) {
          await this.updatePickupTimes(manager, times);
        }
      }
    });
  }

  // Antes de la transacción de aceptar: la ruta con la recogida nueva (OSRM)
  planAcceptance(request: SeatRequest, trip: Trip): Promise<PickupPlan> | null {
    if (request.direction !== 'to-campus' || request.pickupLocation === null) {
      return null;
    }
    return this.tripPickups.planWith(
      trip,
      {
        id: request.id,
        location: request.pickupLocation,
        stopId: request.stopId,
      },
      null,
    );
  }

  // Al pedir plaza: a qué hora le recogería el conductor, después de las
  // recogidas ya aceptadas y sus paradas (OSRM, antes de la transacción)
  async estimatePickupAt(
    trip: Trip,
    location: Point,
    stopId: string | null = null,
  ): Promise<Date> {
    const plan = await this.tripPickups.planWith(
      trip,
      { id: NEW_REQUEST_ID, location, stopId },
      null,
    );
    const pickup = plan.pickups.find(
      ({ requestId }) => requestId === NEW_REQUEST_ID,
    );
    return new Date(
      trip.departureAt.getTime() + (pickup?.etaOffsetMin ?? 0) * MINUTE_MS,
    );
  }

  // Dentro de la transacción, con el viaje bloqueado: guarda la recogida (o
  // falla si ya no cabe o cambió algo) y pone la hora de recogida a la
  // solicitud aceptada y a las demás del viaje
  async applyAcceptance(
    manager: EntityManager,
    trip: Trip,
    request: SeatRequest,
    plan: PickupPlan,
  ): Promise<void> {
    const times = await this.tripPickups.apply(manager, trip, plan);
    request.pickupAt = times.get(request.id) ?? request.pickupAt;
    times.delete(request.id);
    await this.updatePickupTimes(manager, times);
  }

  private async updatePickupTimes(
    manager: EntityManager,
    times: Map<string, Date>,
  ): Promise<void> {
    if (times.size === 0) {
      return;
    }
    // Una sola consulta para todas las solicitudes del viaje
    await manager.query(
      `UPDATE requests r SET pickup_at = v.pickup_at
         FROM unnest($1::uuid[], $2::timestamptz[]) AS v (id, pickup_at)
        WHERE r.id = v.id`,
      [[...times.keys()], [...times.values()]],
    );
  }
}

export function samePoint(first: Point, second: Point): boolean {
  return (
    first.coordinates[0] === second.coordinates[0] &&
    first.coordinates[1] === second.coordinates[1]
  );
}
