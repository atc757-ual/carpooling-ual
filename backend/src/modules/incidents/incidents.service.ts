import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import { RequestsService } from '../requests/requests.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import { Incident } from './entities/incident.entity';
import type {
  IncidentCategory,
  IncidentStatus,
} from './entities/incident.entity';
import { IncidentAlreadyReviewedError } from './errors/incident-already-reviewed.error';
import { IncidentNotFoundError } from './errors/incident-not-found.error';

export interface ReportIncidentInput {
  category: IncidentCategory;
  description: string;
}

// Quien la registró: el conductor (cancela el viaje) o un pasajero (lo
// abandona). Se deduce de la incidencia: solo la del pasajero tiene solicitud
export type ReporterRole = 'driver' | 'passenger';

export interface IncidentView {
  incident: Incident;
  reporterName: string;
  reporterRole: ReporterRole;
}

// Incidencias (RF-23) y su revisión por el administrador (CU-12). Una
// incidencia solo la ven quien la registró y los administradores: protege a
// quien informa de un problema con otra persona
@Injectable()
export class IncidentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Incident)
    private readonly incidentsRepository: Repository<Incident>,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
  ) {}

  // --- Registrar (RF-23)

  // Cancelar DURANTE un viaje en curso exige registrar una incidencia. Todo va
  // en una transacción: o se cancela y queda la incidencia, o no pasa nada.
  // - el conductor: se cancela el viaje (los pasajeros aceptados reciben
  //   prioridad, RF-24, y su vehículo queda libre para otros viajes)
  // - un pasajero aceptado: abandona el viaje; se cancela su solicitud y se
  //   libera su plaza, y el viaje sigue en curso
  async report(
    reporterId: string,
    tripId: string,
    input: ReportIncidentInput,
  ): Promise<IncidentView> {
    const { trip } = await this.tripsService.getById(tripId);
    const incident = await this.dataSource.transaction(async (manager) => {
      const requestId = await this.cancelParticipation(
        manager,
        reporterId,
        trip,
      );
      const created = await manager.save(
        manager.create(Incident, {
          tripId,
          requestId,
          reporterId,
          category: input.category,
          description: input.description,
        }),
      );
      await this.recordEvent(manager, 'incident.reported', created);
      return created;
    });
    return this.toView(incident);
  }

  // Mis incidencias (las que he registrado), las más recientes primero
  async listForReporter(
    reporterId: string,
    page: PageRequest,
  ): Promise<Page<IncidentView>> {
    const [incidents, total] = await this.incidentsRepository.findAndCount({
      where: { reporterId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: await this.toViews(incidents), total };
  }

  // Una incidencia: la ven quien la registró y los administradores
  async get(
    userId: string,
    isAdmin: boolean,
    incidentId: string,
  ): Promise<IncidentView> {
    const incident = await this.incidentsRepository.findOneBy({
      id: incidentId,
    });
    if (incident === null || (!isAdmin && incident.reporterId !== userId)) {
      throw new IncidentNotFoundError(incidentId);
    }
    return this.toView(incident);
  }

  // --- Administrador (CU-12)

  // Incidencias para revisar, por orden de llegada (la más antigua primero)
  async list(
    status: IncidentStatus | undefined,
    page: PageRequest,
  ): Promise<Page<IncidentView>> {
    const [incidents, total] = await this.incidentsRepository.findAndCount({
      where: status === undefined ? {} : { status },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: await this.toViews(incidents), total };
  }

  // "Revisada y cerrada": la revisión es definitiva. La fila se bloquea para
  // que dos administradores no la revisen a la vez
  async review(
    adminId: string,
    incidentId: string,
    resolution: string,
  ): Promise<IncidentView> {
    const incident = await this.dataSource.transaction(async (manager) => {
      const current = await manager.findOne(Incident, {
        where: { id: incidentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (current === null) {
        throw new IncidentNotFoundError(incidentId);
      }
      if (current.status === 'reviewed') {
        throw new IncidentAlreadyReviewedError(incidentId);
      }
      current.status = 'reviewed';
      current.reviewedBy = adminId;
      current.reviewedAt = new Date();
      current.resolution = resolution;
      const reviewed = await manager.save(current);
      await this.recordEvent(manager, 'incident.reviewed', reviewed);
      return reviewed;
    });
    return this.toView(incident);
  }

  // --- Internos

  // Cancela la participación de quien registra la incidencia y devuelve la
  // solicitud afectada (null si es el conductor: se cancela el viaje entero)
  private async cancelParticipation(
    manager: EntityManager,
    reporterId: string,
    trip: Trip,
  ): Promise<string | null> {
    if (trip.driverId === reporterId) {
      await this.tripsService.cancelInProgress(manager, reporterId, trip.id);
      return null;
    }
    const request = await this.requestsService.leaveInProgressTrip(
      manager,
      reporterId,
      trip.id,
    );
    return request.id;
  }

  private async toView(incident: Incident): Promise<IncidentView> {
    const [view] = await this.toViews([incident]);
    return view;
  }

  // Los nombres en una sola consulta (no una por fila)
  private async toViews(incidents: Incident[]): Promise<IncidentView[]> {
    const names = await this.usersService.getNames(
      incidents.map(({ reporterId }) => reporterId),
    );
    return incidents.map((incident) => ({
      incident,
      reporterName: names.get(incident.reporterId) ?? '',
      reporterRole: reporterRoleOf(incident),
    }));
  }

  // Sin la descripción ni la resolución: son texto libre que puede contener
  // datos personales y el Gemelo Digital no lo necesita (minimización)
  private async recordEvent(
    manager: EntityManager,
    type: DomainEventType,
    incident: Incident,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: incident.id,
      payload: {
        tripId: incident.tripId,
        requestId: incident.requestId,
        reporterId: incident.reporterId,
        reporterRole: reporterRoleOf(incident),
        category: incident.category,
        status: incident.status,
        reviewedBy: incident.reviewedBy,
      },
    });
  }
}

function reporterRoleOf(incident: Incident): ReporterRole {
  return incident.requestId === null ? 'driver' : 'passenger';
}
