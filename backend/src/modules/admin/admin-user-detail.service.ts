import { Injectable } from '@nestjs/common';
import type { Incident } from '../incidents/entities/incident.entity';
import { IncidentsService } from '../incidents/incidents.service';
import type { SeatRequest } from '../requests/entities/seat-request.entity';
import { RequestStatsService } from '../requests/request-stats.service';
import type { LateCancellation } from '../trips/entities/late-cancellation.entity';
import type { Trip } from '../trips/entities/trip.entity';
import { TripStatsService } from '../trips/trip-stats.service';
import { TripsService } from '../trips/trips.service';
import { ConsentsService } from '../users/consents.service';
import type { Vehicle } from '../users/entities/vehicle.entity';
import { UserNotFoundError } from '../users/errors/user-not-found.error';
import type { UserConsentsView } from '../users/user-consent';
import { VehiclesService } from '../users/vehicles.service';
import { AdminUserRow, AdminUsersService } from './admin-users.service';

// Cuántos elementos recientes de cada historial muestra el detalle
export const RECENT_ITEMS = 10;

export type IncidentRole = 'reporter' | 'driver';

// Todo lo que ve el administrador de un usuario (RF-25, CU-13). Sin la
// contraseña ni datos que no necesite para gestionarlo
export interface AdminUserDetail {
  row: AdminUserRow;
  vehicles: Vehicle[];
  trips: Trip[];
  requests: { request: SeatRequest; trip: Trip | null }[];
  incidents: { incident: Incident; role: IncidentRole }[];
  lateCancellations: LateCancellation[];
  // null si la cuenta está eliminada (sus consentimientos ya se retiraron)
  consents: UserConsentsView | null;
}

// Detalle de un usuario para el panel: compone lo que exportan usuarios,
// viajes, solicitudes e incidencias
@Injectable()
export class AdminUserDetailService {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly vehicles: VehiclesService,
    private readonly consents: ConsentsService,
    private readonly tripsService: TripsService,
    private readonly tripStats: TripStatsService,
    private readonly requestStats: RequestStatsService,
    private readonly incidents: IncidentsService,
  ) {}

  // Los consentimientos; una cuenta eliminada (desactivada) no tiene, y el
  // panel sigue viendo su ficha. Cualquier otro fallo se propaga
  private async consentsOf(userId: string): Promise<UserConsentsView | null> {
    try {
      return await this.consents.getMyConsents(userId);
    } catch (error) {
      if (error instanceof UserNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  // Lanza UserNotFoundError si no existe
  async get(userId: string): Promise<AdminUserDetail> {
    const row = await this.adminUsers.getRow(userId);
    const [vehicles, trips, requests, incidents, lateCancellations, consents] =
      await Promise.all([
        this.vehicles.listByDriver(userId, { offset: 0, limit: RECENT_ITEMS }),
        this.tripStats.recentByDriver(userId, RECENT_ITEMS),
        this.requestStats.recentByPassenger(userId, RECENT_ITEMS),
        this.incidents.listInvolving(userId, RECENT_ITEMS),
        this.tripStats.recentLateCancellations(userId),
        this.consentsOf(userId),
      ]);
    const requestTrips = await this.tripsService.getByIds(
      requests.map(({ tripId }) => tripId),
    );
    return {
      row,
      vehicles: vehicles.items,
      trips,
      requests: requests.map((request) => ({
        request,
        trip: requestTrips.get(request.tripId) ?? null,
      })),
      incidents: incidents.map((incident) => ({
        incident,
        role: incident.reporterId === userId ? 'reporter' : 'driver',
      })),
      lateCancellations,
      consents,
    };
  }
}
