import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository, In } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestsService } from '../requests/requests.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripStatsService } from '../trips/trip-stats.service';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import { Incident } from './entities/incident.entity';
import type {
  IncidentCategory,
  IncidentStatus,
} from './entities/incident.entity';
import { IncidentNotFoundError } from './errors/incident-not-found.error';
import {
  recordIncidentEvent,
  reporterRoleOf,
  type ReporterRole,
} from './incident-events';

export interface ReportIncidentInput {
  category: IncidentCategory;
  description: string;
}

// Quien la registró: el conductor (cancela el viaje) o un pasajero (lo
// abandona). Se deduce de la incidencia: solo la del pasajero tiene solicitud
export type { ReporterRole } from './incident-events';

// El viaje de la incidencia como lo ve quien la gestiona: el trayecto, la
// hora y el conductor
export interface IncidentTripView {
  originName: string | null;
  destinationName: string | null;
  departureAt: Date;
  driverId: string;
  driverName: string;
}

export interface IncidentView {
  incident: Incident;
  reporterName: string;
  reporterRole: ReporterRole;
  // Quién la está revisando (solo en revisión)
  reviewStartedByName: string | null;
  // null solo si el viaje ya no existe
  trip: IncidentTripView | null;
}

export interface IncidentFilter {
  status?: IncidentStatus;
  category?: IncidentCategory;
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
    private readonly tripStats: TripStatsService,
    private readonly requestsService: RequestsService,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
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
      await this.recordReported(manager, created, trip.driverId);
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

  // Incidencias para revisar: primero las registradas, luego las que están en
  // revisión y al final las atendidas; en cada estado, la más antigua primero
  async list(
    filter: IncidentFilter,
    page: PageRequest,
  ): Promise<Page<IncidentView>> {
    const [incidents, total] = await this.incidentsRepository.findAndCount({
      where: {
        ...(filter.status === undefined ? {} : { status: filter.status }),
        ...(filter.category === undefined ? {} : { category: filter.category }),
      },
      // El enum se ordena como se declaró: registradas, en revisión, atendidas
      order: { status: 'ASC', createdAt: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items: await this.toViews(incidents), total };
  }

  // Una incidencia nueva (del viaje en curso o de un mensaje del chat): su
  // evento y el aviso a los administradores, en la transacción que la crea
  async recordReported(
    manager: EntityManager,
    incident: Incident,
    driverId: string,
  ): Promise<void> {
    await recordIncidentEvent(this.eventsService, manager, {
      type: 'incident.reported',
      incident,
      driverId,
    });
    await this.notifyAdmins(manager, incident);
  }

  // La incidencia con su viaje y los nombres, como la devuelve la API
  async toView(incident: Incident): Promise<IncidentView> {
    const [view] = await this.toViews([incident]);
    return view;
  }

  // --- Internos

  // Cancela la participación de quien registra la incidencia y devuelve la
  // solicitud afectada (null si es el conductor: se cancela el viaje entero)
  // Incidencias abiertas en las que aparece cada usuario (quien la registró o
  // el conductor del viaje), para el panel. Las abiertas son pocas: se cargan
  // todas de una vez
  // Las últimas incidencias en las que aparece el usuario (las que registró y
  // las de los viajes que conduce), para el detalle del panel
  async listInvolving(userId: string, limit: number): Promise<Incident[]> {
    const tripIds = await this.tripStats.idsByDriver(userId);
    return this.incidentsRepository.find({
      where:
        tripIds.length === 0
          ? { reporterId: userId }
          : [{ reporterId: userId }, { tripId: In(tripIds) }],
      order: { createdAt: 'DESC', id: 'ASC' },
      take: limit,
    });
  }

  async countOpenByUser(): Promise<Map<string, number>> {
    const open = await this.incidentsRepository.find({
      where: { status: 'open' },
      select: { id: true, tripId: true, reporterId: true },
    });
    const trips = await this.tripsService.getByIds(
      open.map(({ tripId }) => tripId),
    );
    const counts = new Map<string, number>();
    for (const incident of open) {
      const driverId = trips.get(incident.tripId)?.driverId;
      const involved = new Set([
        incident.reporterId,
        driverId ?? incident.reporterId,
      ]);
      for (const userId of involved) {
        counts.set(userId, (counts.get(userId) ?? 0) + 1);
      }
    }
    return counts;
  }

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

  // RF-19: aviso a los administradores activos de cada incidencia nueva,
  // salvo a quien la registró (si también es administrador)
  private async notifyAdmins(
    manager: EntityManager,
    incident: Incident,
  ): Promise<void> {
    const adminIds = await this.usersService.getActiveAdminIds(manager);
    await this.notificationsService.notify(
      manager,
      adminIds.filter((id) => id !== incident.reporterId),
      {
        type: 'incident_reported',
        tripId: incident.tripId,
        incidentId: incident.id,
      },
    );
  }

  // Los viajes y los nombres en una consulta cada uno (no una por fila)
  private async toViews(incidents: Incident[]): Promise<IncidentView[]> {
    const trips = await this.tripsService.getByIds(
      incidents.map(({ tripId }) => tripId),
    );
    const names = await this.usersService.getNames([
      ...incidents.map(({ reporterId }) => reporterId),
      ...incidents.flatMap(({ reviewStartedBy }) =>
        reviewStartedBy ? [reviewStartedBy] : [],
      ),
      ...[...trips.values()].map(({ driverId }) => driverId),
    ]);
    return incidents.map((incident) => {
      const trip = trips.get(incident.tripId);
      return {
        incident,
        reporterName: names.get(incident.reporterId) ?? '',
        reporterRole: reporterRoleOf(incident, trip?.driverId),
        reviewStartedByName: incident.reviewStartedBy
          ? (names.get(incident.reviewStartedBy) ?? '')
          : null,
        trip: trip
          ? {
              originName: trip.originName,
              destinationName: trip.destinationName,
              departureAt: trip.departureAt,
              driverId: trip.driverId,
              driverName: names.get(trip.driverId) ?? '',
            }
          : null,
      };
    });
  }
}
