import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { TripRoute } from '../trips/entities/trip-route.entity';
import { RouteNotFoundError } from '../trips/errors/route-not-found.error';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatusService } from '../trips/trip-status.service';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestSchedule } from './request-schedule';

export interface OverlappingRequest {
  requestId: string;
  tripId: string;
}

@Injectable()
export class RequestOverlapService {
  constructor(private readonly tripStatus: TripStatusService) {}

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
    const route = await manager.findOneBy(TripRoute, { tripId: trip.id });
    if (route === null) {
      throw new RouteNotFoundError(trip.id);
    }
    return { departureAt: trip.departureAt, durationMin: route.durationMin };
  }

  async overlappingPendingRequests(
    manager: EntityManager,
    passengerId: string,
    schedule: RequestSchedule,
    excludedRequestId?: string,
  ): Promise<OverlappingRequest[]> {
    const startsAt = schedule.departureAt;
    const endsAt = new Date(startsAt.getTime() + schedule.durationMin * 60_000);
    return manager.query<OverlappingRequest[]>(
      `SELECT request.id AS "requestId", request.trip_id AS "tripId"
       FROM requests request
       JOIN trips trip ON trip.id = request.trip_id
       JOIN routes route ON route.trip_id = trip.id
       WHERE request.passenger_id = $1
         AND request.status = 'pending'
         AND trip.status IN ('published', 'confirmed')
         AND trip.departure_at < $3
         AND trip.departure_at + route.duration_min * INTERVAL '1 minute' > $2
         AND ($4::uuid IS NULL OR request.id <> $4::uuid)
       ORDER BY trip.id, request.id`,
      [passengerId, startsAt, endsAt, excludedRequestId ?? null],
    );
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
