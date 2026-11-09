import type { EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import type { EventsService } from '../../events/events.service';
import type { Incident } from './entities/incident.entity';

export type ReporterRole = 'driver' | 'passenger';

// Con el conductor del viaje, comparándolo; sin él (viaje borrado), por la
// solicitud: solo el pasajero que abandona el viaje la tiene
export function reporterRoleOf(
  incident: Incident,
  driverId?: string,
): ReporterRole {
  if (driverId !== undefined) {
    return incident.reporterId === driverId ? 'driver' : 'passenger';
  }
  return incident.requestId === null ? 'driver' : 'passenger';
}

// El evento de la incidencia (outbox), en la transacción del cambio. Sin la
// descripción ni la resolución: son texto libre que puede contener datos
// personales y el Gemelo Digital no lo necesita (minimización)
export async function recordIncidentEvent(
  events: EventsService,
  manager: EntityManager,
  {
    type,
    incident,
    driverId,
  }: {
    type: DomainEventType;
    incident: Incident;
    driverId?: string;
  },
): Promise<void> {
  await events.record(manager, {
    type,
    sourceEntityId: incident.id,
    payload: {
      number: incident.number,
      tripId: incident.tripId,
      requestId: incident.requestId,
      reporterId: incident.reporterId,
      reporterRole: reporterRoleOf(incident, driverId),
      category: incident.category,
      status: incident.status,
      reviewStartedBy: incident.reviewStartedBy,
      reviewedBy: incident.reviewedBy,
    },
  });
}
