import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { Trip } from '../trips/entities/trip.entity';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestOverlapService } from './request-overlap.service';
import { assertRequestTransition } from './request-status';

@Injectable()
export class RequestAcceptanceListener implements OnModuleInit {
  constructor(
    private readonly changes: RequestChangesRecorder,
    private readonly overlaps: RequestOverlapService,
  ) {}

  onModuleInit(): void {
    this.changes.onRequestChanged(async (manager, change) => {
      if (change.type === 'request.accepted') {
        await this.cancelOverlappingRequests(
          manager,
          change.request,
          change.trip,
        );
      }
    });
  }

  private async cancelOverlappingRequests(
    manager: EntityManager,
    accepted: SeatRequest,
    acceptedTrip: Trip,
  ): Promise<void> {
    const schedule = await this.overlaps.scheduleForTrip(manager, acceptedTrip);
    const candidates = await this.overlaps.overlappingPendingRequests(
      manager,
      accepted.passengerId,
      schedule,
      accepted.id,
    );
    const pending = await this.overlaps.lockPendingRequests(
      manager,
      candidates,
    );
    const tripIds = [...new Set(pending.map(({ tripId }) => tripId))];
    const trips = await manager.find(Trip, { where: { id: In(tripIds) } });
    const tripsById = new Map(trips.map((trip) => [trip.id, trip]));
    const cancelledRequests: Array<{ request: SeatRequest; trip: Trip }> = [];

    for (const request of pending) {
      const trip = tripsById.get(request.tripId);
      if (trip === undefined) {
        continue;
      }
      assertRequestTransition(request.status, 'cancelled');
      request.status = 'cancelled';
      request.cancelledAt = new Date();
      cancelledRequests.push({ request, trip });
    }

    if (cancelledRequests.length === 0) {
      return;
    }
    const savedRequests = await manager.save(
      cancelledRequests.map(({ request }) => request),
    );
    for (const request of savedRequests) {
      const trip = tripsById.get(request.tripId);
      if (trip !== undefined) {
        // Las escrituras usan la misma conexión y transacción.
        await this.changes.recordOverlapCancellation(manager, request, trip); // NOSONAR: la conexión transaccional requiere escrituras secuenciales
      }
    }
  }
}
