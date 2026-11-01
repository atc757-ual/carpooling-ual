import { Injectable } from '@nestjs/common';
import { Page, PageRequest } from '../../shared/pagination/page';
import { IncidentsService } from '../incidents/incidents.service';
import { RequestStatsService } from '../requests/request-stats.service';
import type { LateCancellationRole } from '../trips/entities/late-cancellation.entity';
import {
  LateCancellationsService,
  UserSuspensions,
} from '../trips/late-cancellations.service';
import { TripStatsService } from '../trips/trip-stats.service';
import { accountStatusOf } from '../users/admin-user-filter';
import type { AdminUserFilter } from '../users/admin-user-filter';
import type { ProfileType } from '../users/profile-type';
import {
  UserAdminView,
  UserProfilesService,
} from '../users/user-profiles.service';
import { isAccountStatus, statusesOf } from './admin-user-status';
import type { AdminUserStatus } from './admin-user-status';

export interface AdminUserQuery {
  search?: string;
  profile?: ProfileType;
  status?: AdminUserStatus;
}

// Un usuario de la lista del panel con lo que dicen de él los demás módulos
export interface AdminUserRow extends UserAdminView {
  statuses: AdminUserStatus[];
  tripCount: number;
  openIncidents: number;
  suspensions: UserSuspensions | null;
}

// Usuarios para el panel de administración (RF-25, CU-13). No tiene tablas:
// compone lo que exportan usuarios, viajes, solicitudes e incidencias, que no
// pueden conocerse entre sí en ese sentido (dependen de usuarios)
@Injectable()
export class AdminUsersService {
  constructor(
    private readonly userProfiles: UserProfilesService,
    private readonly lateCancellations: LateCancellationsService,
    private readonly incidents: IncidentsService,
    private readonly tripStats: TripStatsService,
    private readonly requestStats: RequestStatsService,
  ) {}

  async list(
    query: AdminUserQuery,
    page: PageRequest,
  ): Promise<Page<AdminUserRow>> {
    const openIncidents = await this.incidents.countOpenByUser();
    const filter = await this.toFilter(query, openIncidents);
    const { items, total } = await this.userProfiles.list(filter, page);
    const ids = items.map(({ user }) => user.id);
    const [suspensions, driven, ridden] = await Promise.all([
      this.lateCancellations.findSuspensions(ids),
      this.tripStats.countByDrivers(ids),
      this.requestStats.countAcceptedByPassengers(ids),
    ]);
    return {
      items: items.map((view) => {
        const id = view.user.id;
        const incidents = openIncidents.get(id) ?? 0;
        const account = accountStatusOf(
          view.user,
          view.profiles.map(({ isActive }) => isActive),
        );
        return {
          ...view,
          statuses: statusesOf(account, suspensions.has(id), incidents),
          tripCount: (driven.get(id) ?? 0) + (ridden.get(id) ?? 0),
          openIncidents: incidents,
          suspensions: suspensions.get(id) ?? null,
        };
      }),
      total,
    };
  }

  // Levanta la suspensión de un papel antes de tiempo, con su motivo
  async liftSuspension(
    adminId: string,
    userId: string,
    input: { role: LateCancellationRole; reason: string },
  ): Promise<void> {
    // Lanza UserNotFoundError si no existe
    await this.userProfiles.getAdminView(userId);
    await this.lateCancellations.waive({ adminId, userId, ...input });
  }

  // Los estados de otros módulos se convierten en la lista de ids posibles
  private async toFilter(
    query: AdminUserQuery,
    openIncidents: Map<string, number>,
  ): Promise<AdminUserFilter> {
    const { search, profile, status } = query;
    if (status === undefined || isAccountStatus(status)) {
      return { search, profile, status };
    }
    if (status === 'open_incidents') {
      return { search, profile, userIds: [...openIncidents.keys()] };
    }
    const suspended = await this.lateCancellations.findSuspensions();
    return { search, profile, userIds: [...suspended.keys()] };
  }
}
