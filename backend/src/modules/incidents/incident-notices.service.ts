import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import { Incident } from './entities/incident.entity';

// Los avisos del curso de una incidencia (RF-19, CU-12), en la transacción de
// cada cambio (y por push al confirmarse):
// - registrada: a los administradores que pueden gestionarla, «Nueva
//   incidencia»; a quien la registró, «Hemos recibido tu reporte»
// - un administrador la coge: a quien la registró, «Estamos revisando tu
//   reporte»; el aviso de los demás administradores dice quién la revisa
// - la suelta: el aviso de los demás deja de decir quién
// - atendida: a quien la registró, «Hemos atendido tu reporte»
@Injectable()
export class IncidentNoticesService {
  constructor(
    private readonly usersService: UsersService,
    private readonly requestsService: RequestsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async reported(
    manager: EntityManager,
    incident: Incident,
    driverId: string,
  ): Promise<void> {
    const adminIds = await this.handlingAdminIds(manager, incident, driverId);
    await this.notify(manager, adminIds, 'incident_reported', incident);
    await this.notify(
      manager,
      [incident.reporterId],
      'incident_received',
      incident,
    );
  }

  async reviewStarted(
    manager: EntityManager,
    incident: Incident,
    adminId: string,
  ): Promise<void> {
    await this.notify(
      manager,
      [incident.reporterId],
      'incident_in_review',
      incident,
    );
    const names = await this.usersService.getNames([adminId]);
    await this.notificationsService.setIncidentReviewer(manager, incident.id, {
      reviewerId: adminId,
      reviewerName: givenName(names.get(adminId) ?? ''),
    });
  }

  async reviewReleased(
    manager: EntityManager,
    incident: Incident,
    adminId: string,
  ): Promise<void> {
    await this.notificationsService.setIncidentReviewer(manager, incident.id, {
      reviewerId: adminId,
      reviewerName: null,
    });
  }

  async reviewed(manager: EntityManager, incident: Incident): Promise<void> {
    await this.notify(
      manager,
      [incident.reporterId],
      'incident_reviewed',
      incident,
    );
  }

  // Los administradores activos que pueden gestionarla: ninguno implicado en
  // el viaje (quien la registró, quien lo conduce o quien pidió plaza en él;
  // CU-12)
  async handlingAdminIds(
    manager: EntityManager,
    incident: Incident,
    driverId: string,
  ): Promise<string[]> {
    const adminIds = await this.usersService.getActiveAdminIds(manager);
    const candidates = adminIds.filter(
      (id) => id !== incident.reporterId && id !== driverId,
    );
    const involved = await Promise.all(
      candidates.map(async (id) =>
        (
          await this.requestsService.tripIdsRequestedBy(
            id,
            [incident.tripId],
            manager,
          )
        ).has(incident.tripId),
      ),
    );
    return candidates.filter((_, index) => !involved[index]);
  }

  private notify(
    manager: EntityManager,
    recipientIds: readonly string[],
    type:
      | 'incident_reported'
      | 'incident_received'
      | 'incident_in_review'
      | 'incident_reviewed',
    incident: Incident,
  ): Promise<void> {
    return this.notificationsService.notify(manager, recipientIds, {
      type,
      tripId: incident.tripId,
      incidentId: incident.id,
    });
  }
}

// El nombre de pila («Ana» de «Ana Pérez»); sin nombre (cuenta borrada), null
function givenName(name: string): string | null {
  return name.trim().split(/\s+/)[0] || null;
}
