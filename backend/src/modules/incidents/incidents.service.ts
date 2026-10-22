import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { RequestsService } from '../requests/requests.service';
import { Trip } from '../trips/entities/trip.entity';
import { TripsService } from '../trips/trips.service';
import { Incident } from './entities/incident.entity';
import type { IncidentCategory } from './entities/incident.entity';

export interface ReportIncidentInput {
  category: IncidentCategory;
  description: string;
}

// Incidencias (RF-23): cancelar DURANTE un viaje en curso exige registrar una
// incidencia. Todo va en una transacción: o se cancela y queda la incidencia,
// o no pasa nada
@Injectable()
export class IncidentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
    private readonly eventsService: EventsService,
  ) {}

  // Según quién la registra:
  // - el conductor: se cancela el viaje (los pasajeros aceptados reciben
  //   prioridad, RF-24, y su vehículo queda libre para otros viajes)
  // - un pasajero aceptado: abandona el viaje; se cancela su solicitud y se
  //   libera su plaza, y el viaje sigue en curso
  async report(
    reporterId: string,
    tripId: string,
    input: ReportIncidentInput,
  ): Promise<Incident> {
    const { trip } = await this.tripsService.getById(tripId);
    return this.dataSource.transaction(async (manager) => {
      const requestId = await this.cancelParticipation(
        manager,
        reporterId,
        trip,
      );
      const incident = await manager.save(
        manager.create(Incident, {
          tripId,
          requestId,
          reporterId,
          category: input.category,
          description: input.description,
        }),
      );
      // Sin la descripción: es texto libre que puede contener datos
      // personales y el Gemelo Digital no la necesita (minimización)
      await this.eventsService.record(manager, {
        type: 'incident.reported',
        sourceEntityId: incident.id,
        payload: {
          tripId,
          requestId,
          reporterId,
          reporterRole: requestId === null ? 'driver' : 'passenger',
          category: incident.category,
        },
      });
      return incident;
    });
  }

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
}
