import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import type { NotificationType } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Trip } from '../trips/entities/trip.entity';
import { SeatRequest } from './entities/seat-request.entity';

export type RequestEventType = Extract<DomainEventType, `request.${string}`>;

export interface RequestNotice {
  recipientId: string;
  type: NotificationType;
}

// Reglas fijas de aviso (RF-19) para cada cambio de una solicitud: se avisa a
// la otra parte, nunca a quien hizo el cambio. Una cancelación se distingue
// por el estado del viaje:
// - viaje cancelado: la solicitud cayó con el viaje; se avisa al pasajero
// - viaje en curso: el pasajero lo abandona (RF-23); se avisa al conductor
// - si no: el pasajero cancela antes del viaje; se avisa al conductor
export function noticeFor(
  type: RequestEventType,
  request: SeatRequest,
  trip: Trip,
): RequestNotice {
  const toDriver = (notice: NotificationType): RequestNotice => ({
    recipientId: trip.driverId,
    type: notice,
  });
  const toPassenger = (notice: NotificationType): RequestNotice => ({
    recipientId: request.passengerId,
    type: notice,
  });
  switch (type) {
    case 'request.created':
      return toDriver('request_received');
    case 'request.accepted':
      return toPassenger('request_accepted');
    case 'request.rejected':
      return toPassenger('request_rejected');
    case 'request.cancelled':
      if (trip.status === 'cancelled') {
        return toPassenger('trip_cancelled');
      }
      return toDriver(
        trip.status === 'in_progress' ? 'passenger_left' : 'request_cancelled',
      );
  }
}

// Cada cambio de una solicitud deja, en la misma transacción, su evento para
// el Gemelo Digital (con el estado completo de la solicitud) y el aviso a la
// otra parte. Lo comparten RequestsService y TripChangesListener
@Injectable()
export class RequestChangesRecorder {
  constructor(
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async record(
    manager: EntityManager,
    type: RequestEventType,
    request: SeatRequest,
    trip: Trip,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: request.id,
      payload: {
        tripId: request.tripId,
        passengerId: request.passengerId,
        seats: request.seats,
        isPriority: request.isPriority,
        requestedAt: request.requestedAt.toISOString(),
        status: request.status,
      },
    });
    const notice = noticeFor(type, request, trip);
    await this.notificationsService.notify(manager, [notice.recipientId], {
      type: notice.type,
      tripId: trip.id,
      requestId: request.id,
    });
  }
}
