import { Injectable } from '@nestjs/common';
import type { DomainEvent } from '../../events/entities/domain-event.entity';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import type { SeatRequest } from '../requests/entities/seat-request.entity';
import {
  RequestStatsService,
  TripRequestCounts,
} from '../requests/request-stats.service';
import type { Trip } from '../trips/entities/trip.entity';
import { TripStatsService } from '../trips/trip-stats.service';
import type { TripStatus } from '../trips/trip-status';
import { UsersService } from '../users/users.service';

export interface AdminTripQuery {
  status?: TripStatus;
  from?: string;
  to?: string;
  // Texto que buscar en el nombre o el correo del conductor
  driver?: string;
}

export interface AdminTripRow {
  trip: Trip;
  driverName: string | null;
  requests: TripRequestCounts;
}

export interface AdminTripDetail extends AdminTripRow {
  seatRequests: { request: SeatRequest; passengerName: string | null }[];
  // Los eventos del viaje y de sus solicitudes, en orden
  timeline: DomainEvent[];
}

const NO_REQUESTS: TripRequestCounts = { pending: 0, accepted: 0 };

// Viajes para el panel de administración (solo lectura): compone lo que
// exportan viajes, solicitudes, usuarios y eventos
@Injectable()
export class AdminTripsService {
  constructor(
    private readonly tripStats: TripStatsService,
    private readonly requestStats: RequestStatsService,
    private readonly users: UsersService,
    private readonly events: EventsService,
  ) {}

  async list(
    query: AdminTripQuery,
    page: PageRequest,
  ): Promise<Page<AdminTripRow>> {
    const driverIds = query.driver
      ? await this.users.findIdsBySearch(query.driver)
      : undefined;
    const trips = await this.tripStats.listForAdmin(
      { status: query.status, from: query.from, to: query.to, driverIds },
      page,
    );
    const [names, counts] = await Promise.all([
      this.users.getNames(trips.items.map((trip) => trip.driverId)),
      this.requestStats.countByTrips(trips.items.map((trip) => trip.id)),
    ]);
    return {
      items: trips.items.map((trip) => ({
        trip,
        driverName: names.get(trip.driverId) ?? null,
        requests: counts.get(trip.id) ?? NO_REQUESTS,
      })),
      total: trips.total,
    };
  }

  // Lanza TripNotFoundError si no existe
  async get(tripId: string): Promise<AdminTripDetail> {
    const trip = await this.tripStats.get(tripId);
    const seatRequests = await this.requestStats.byTrip(tripId);
    const [names, timeline] = await Promise.all([
      this.users.getNames([
        trip.driverId,
        ...seatRequests.map((request) => request.passengerId),
      ]),
      this.events.listBySources([
        trip.id,
        ...seatRequests.map((request) => request.id),
      ]),
    ]);
    return {
      trip,
      driverName: names.get(trip.driverId) ?? null,
      requests: {
        pending: countWithStatus(seatRequests, 'pending'),
        accepted: countWithStatus(seatRequests, 'accepted'),
      },
      seatRequests: seatRequests.map((request) => ({
        request,
        passengerName: names.get(request.passengerId) ?? null,
      })),
      timeline,
    };
  }
}

function countWithStatus(
  requests: readonly SeatRequest[],
  status: SeatRequest['status'],
): number {
  return requests.filter((request) => request.status === status).length;
}
