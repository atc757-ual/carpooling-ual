import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { Point } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import { TripPickupsService } from '../trips/trip-pickups.service';
import type { PickupPlan } from '../trips/trip-pickups.service';
import { MINUTE_MS } from '../trips/trip-timing';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';

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
    private readonly changes: RequestChangesRecorder,
  ) {}

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
      { id: request.id, location: request.pickupLocation },
      null,
    );
  }

  // Al pedir plaza: a qué hora le recogería el conductor, después de las
  // recogidas ya aceptadas y sus paradas (OSRM, antes de la transacción)
  async estimatePickupAt(trip: Trip, location: Point): Promise<Date> {
    const plan = await this.tripPickups.planWith(
      trip,
      { id: NEW_REQUEST_ID, location },
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
    for (const [requestId, pickupAt] of times) {
      await manager.update(SeatRequest, { id: requestId }, { pickupAt });
    }
  }
}
