import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { RequestsService } from '../requests/requests.service';
import { TripsService } from '../trips/trips.service';
import { Incident } from './entities/incident.entity';
import type { IncidentStatus } from './entities/incident.entity';
import { IncidentAlreadyReviewedError } from './errors/incident-already-reviewed.error';
import { IncidentInvolvedAdminError } from './errors/incident-involved-admin.error';
import { IncidentNotFoundError } from './errors/incident-not-found.error';
import { IncidentReviewTakenError } from './errors/incident-review-taken.error';
import { recordIncidentEvent } from './incident-events';
import { assertTransition } from './incident-status';
import { IncidentsService, type IncidentView } from './incidents.service';

interface ReviewChange {
  to: IncidentStatus;
  event: DomainEventType;
  apply: (incident: Incident, adminId: string) => void;
}

// La revisión de una incidencia por el administrador (CU-12): registrada →
// en revisión (la coge un administrador) → atendida, con la resolución. Quien
// la revisa es el único que puede dejarla o atenderla, y un administrador
// implicado en el viaje no puede gestionarla. Cada cambio bloquea la fila (dos
// administradores a la vez) y registra su evento
@Injectable()
export class IncidentReviewService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly incidentsService: IncidentsService,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
    private readonly eventsService: EventsService,
  ) {}

  async start(adminId: string, incidentId: string): Promise<IncidentView> {
    return this.change(adminId, incidentId, {
      to: 'in_review',
      event: 'incident.review_started',
      apply: (incident, admin) => {
        incident.reviewStartedBy = admin;
        incident.reviewStartedAt = new Date();
      },
    });
  }

  async release(adminId: string, incidentId: string): Promise<IncidentView> {
    return this.change(adminId, incidentId, {
      to: 'open',
      event: 'incident.review_released',
      apply: (incident) => {
        incident.reviewStartedBy = null;
        incident.reviewStartedAt = null;
      },
    });
  }

  // "Atendida": definitiva, con la resolución
  async resolve(
    adminId: string,
    incidentId: string,
    resolution: string,
  ): Promise<IncidentView> {
    return this.change(adminId, incidentId, {
      to: 'reviewed',
      event: 'incident.reviewed',
      apply: (incident, admin) => {
        incident.reviewedBy = admin;
        incident.reviewedAt = new Date();
        incident.resolution = resolution;
      },
    });
  }

  private async change(
    adminId: string,
    incidentId: string,
    change: ReviewChange,
  ): Promise<IncidentView> {
    const incident = await this.dataSource.transaction(async (manager) => {
      const current = await this.lock(manager, incidentId);
      const trip = (await this.tripsService.getByIds([current.tripId])).get(
        current.tripId,
      );
      if (await this.isInvolved(current, adminId, trip?.driverId, manager)) {
        throw new IncidentInvolvedAdminError(current.id);
      }
      assertCanChange(current, adminId, change.to);
      current.status = change.to;
      change.apply(current, adminId);
      const saved = await manager.save(current);
      await recordIncidentEvent(this.eventsService, manager, {
        type: change.event,
        incident: saved,
        driverId: trip?.driverId,
      });
      return saved;
    });
    return this.incidentsService.toView(incident, adminId);
  }

  // ¿Está implicado en el viaje? La registró, lo conduce o pidió plaza en él
  // (en cualquier estado): conflicto de intereses (CU-12)
  private async isInvolved(
    incident: Incident,
    adminId: string,
    driverId: string | undefined,
    manager: EntityManager,
  ): Promise<boolean> {
    if (incident.reporterId === adminId || driverId === adminId) {
      return true;
    }
    const requested = await this.requestsService.tripIdsRequestedBy(
      adminId,
      [incident.tripId],
      manager,
    );
    return requested.has(incident.tripId);
  }

  private async lock(
    manager: EntityManager,
    incidentId: string,
  ): Promise<Incident> {
    const incident = await manager.findOne(Incident, {
      where: { id: incidentId },
      lock: { mode: 'pessimistic_write' },
    });
    if (incident === null) {
      throw new IncidentNotFoundError(incidentId);
    }
    return incident;
  }
}

// Atendida, ya no se mueve; en revisión, solo quien la revisa; y el resto lo
// decide la tabla de transiciones
function assertCanChange(
  incident: Incident,
  adminId: string,
  to: IncidentStatus,
): void {
  if (incident.status === 'reviewed') {
    throw new IncidentAlreadyReviewedError(incident.id);
  }
  if (incident.status === 'in_review' && incident.reviewStartedBy !== adminId) {
    throw new IncidentReviewTakenError(incident.id);
  }
  assertTransition(incident.status, to);
}
