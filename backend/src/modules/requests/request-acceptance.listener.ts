import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
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

    for (const request of pending) {
      const trip = await manager.findOneBy(Trip, { id: request.tripId });
      if (trip === null) {
        continue;
      }
      assertRequestTransition(request.status, 'cancelled');
      request.status = 'cancelled';
      request.cancelledAt = new Date();
      const cancelled = await manager.save(request);
      await this.changes.recordOverlapCancellation(manager, cancelled, trip);
    }
  }
}
