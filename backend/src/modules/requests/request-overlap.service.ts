import { Injectable } from '@nestjs/common';
import { EntityManager, In, Not } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import { TripLookupService } from '../trips/trip-lookup.service';
import { TripStatusService } from '../trips/trip-status.service';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestSchedule, schedulesOverlap } from './request-schedule';

export interface OverlappingRequest {
  requestId: string;
  tripId: string;
}

// Por viaje y después por solicitud: el orden en que se bloquean
function byTripThenRequest(
  first: OverlappingRequest,
  second: OverlappingRequest,
): number {
  return (
    first.tripId.localeCompare(second.tripId) ||
    first.requestId.localeCompare(second.requestId)
  );
}

@Injectable()
export class RequestOverlapService {
  constructor(
    private readonly tripStatus: TripStatusService,
    private readonly tripLookup: TripLookupService,
  ) {}

  async lockPassenger(
    manager: EntityManager,
    passengerId: string,
  ): Promise<void> {
    // Serializa las solicitudes del mismo pasajero sin bloquear viajes en orden
    // distinto; los bloqueos de viajes y solicitudes mantienen su orden propio
    await manager.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [passengerId],
    );
  }

  async scheduleForTrip(
    manager: EntityManager,
    trip: Pick<Trip, 'id' | 'departureAt'>,
  ): Promise<RequestSchedule> {
    return {
      departureAt: trip.departureAt,
      durationMin: await this.tripLookup.durationMin(manager, trip.id),
    };
  }

  // Las solicitudes pendientes del pasajero en viajes que aún las admiten y
  // se solapan en horario con el dado. Los horarios los da trips: este módulo
  // no consulta sus tablas
  async overlappingPendingRequests(
    manager: EntityManager,
    passengerId: string,
    schedule: RequestSchedule,
    excludedRequestId?: string,
  ): Promise<OverlappingRequest[]> {
    const pending = await manager.find(SeatRequest, {
      where: {
        passengerId,
        status: 'pending',
        ...(excludedRequestId ? { id: Not(excludedRequestId) } : {}),
      },
      select: { id: true, tripId: true },
    });
    const windows = await this.tripLookup.openWindows(
      manager,
      pending.map(({ tripId }) => tripId),
    );
    return pending
      .filter(({ tripId }) => {
        const window = windows.get(tripId);
        return window !== undefined && schedulesOverlap(schedule, window);
      })
      .map(({ id, tripId }) => ({ requestId: id, tripId }))
      .sort(byTripThenRequest);
  }

  async lockTripsInOrder(
    manager: EntityManager,
    tripIds: readonly string[],
  ): Promise<Map<string, Trip>> {
    const lockedTrips = new Map<string, Trip>();
    // Se bloquean uno a uno y en orden para evitar interbloqueos.
    for (const tripId of [...new Set(tripIds)].sort((a, b) =>
      a.localeCompare(b),
    )) {
      const tripPromise = this.tripStatus.lockTrip(manager, tripId);
      const trip = await tripPromise; // NOSONAR: el bloqueo secuencial evita interbloqueos
      lockedTrips.set(tripId, trip);
    }
    return lockedTrips;
  }

  async lockPendingRequests(
    manager: EntityManager,
    requests: readonly OverlappingRequest[],
  ): Promise<SeatRequest[]> {
    const requestIds = requests.map(({ requestId }) => requestId);
    if (requestIds.length === 0) {
      return [];
    }
    return manager.find(SeatRequest, {
      where: { id: In(requestIds), status: 'pending' },
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async lockRequestsById(
    manager: EntityManager,
    requestIds: readonly string[],
  ): Promise<SeatRequest[]> {
    const locked: SeatRequest[] = [];
    // Se bloquean uno a uno y en orden para evitar interbloqueos.
    for (const requestId of [...new Set(requestIds)].sort((a, b) =>
      a.localeCompare(b),
    )) {
      const requestPromise = manager.findOne(SeatRequest, {
        where: { id: requestId },
        lock: { mode: 'pessimistic_write' },
      });
      const request = await requestPromise; // NOSONAR: el bloqueo secuencial evita interbloqueos
      if (request !== null) {
        locked.push(request);
      }
    }
    return locked;
  }
}
