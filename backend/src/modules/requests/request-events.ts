import { EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { SeatRequest } from './entities/seat-request.entity';

// Evento para el Gemelo Digital con el estado completo de la solicitud. Lo
// comparten RequestsService y TripChangesListener
export async function recordRequestEvent(
  eventsService: EventsService,
  manager: EntityManager,
  type: DomainEventType,
  request: SeatRequest,
): Promise<void> {
  await eventsService.record(manager, {
    type,
    sourceEntityId: request.id,
    payload: {
      tripId: request.tripId,
      passengerId: request.passengerId,
      isPriority: request.isPriority,
      requestedAt: request.requestedAt.toISOString(),
      status: request.status,
    },
  });
}
