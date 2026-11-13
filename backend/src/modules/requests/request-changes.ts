import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import type { TripNotificationType } from '../notifications/entities/notification.entity';
import { NotificationsService } from '../notifications/notifications.service';
import type { Trip } from '../trips/entities/trip.entity';
import { SeatRequest } from './entities/seat-request.entity';

export type RequestEventType = Extract<DomainEventType, `request.${string}`>;

export interface RequestNotice {
  recipientId: string;
  type: TripNotificationType;
}

export interface RequestChange {
  type: RequestEventType;
  request: SeatRequest;
  trip: Trip;
}

export type RequestChangeListener = (
  manager: EntityManager,
  change: RequestChange,
) => Promise<void>;

// El estado completo de la solicitud en sus eventos (para el Gemelo Digital)
export function requestPayload(request: SeatRequest): Record<string, unknown> {
  return {
    tripId: request.tripId,
    passengerId: request.passengerId,
    seats: request.seats,
    isPriority: request.isPriority,
    direction: request.direction,
    pickupLocation: request.pickupLocation,
    stopId: request.stopId ?? null,
    pickupAt: request.pickupAt?.toISOString() ?? null,
    requestedAt: request.requestedAt.toISOString(),
    status: request.status,
    answeredAt: request.answeredAt?.toISOString() ?? null,
    cancelledAt: request.cancelledAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason ?? null,
    boardedAt: request.boardedAt?.toISOString() ?? null,
  };
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
  const toDriver = (notice: TripNotificationType): RequestNotice => ({
    recipientId: trip.driverId,
    type: notice,
  });
  const toPassenger = (notice: TripNotificationType): RequestNotice => ({
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
    case 'request.expired':
      return toPassenger('request_expired');
    case 'request.boarded':
      return toPassenger('trip_started');
    case 'request.cancelled':
      if (request.rejectionReason === 'no_show') {
        return toPassenger('passenger_no_show');
      }
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
  private readonly listeners: RequestChangeListener[] = [];

  constructor(
    private readonly eventsService: EventsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onRequestChanged(listener: RequestChangeListener): void {
    this.listeners.push(listener);
  }

  async record(
    manager: EntityManager,
    type: RequestEventType,
    request: SeatRequest,
    trip: Trip,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: request.id,
      payload: requestPayload(request),
    });
    const notice = noticeFor(type, request, trip);
    await this.notificationsService.notify(manager, [notice.recipientId], {
      type: notice.type,
      tripId: trip.id,
      requestId: request.id,
    });
    await Promise.all(
      this.listeners.map((listener) =>
        listener(manager, { type, request, trip }),
      ),
    );
  }

  async recordOverlapCancellation(
    manager: EntityManager,
    request: SeatRequest,
    trip: Trip,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type: 'request.cancelled',
      sourceEntityId: request.id,
      payload: requestPayload(request),
    });
    await Promise.all([
      this.notificationsService.notify(manager, [request.passengerId], {
        type: 'request_conflict_cancelled',
        tripId: trip.id,
        requestId: request.id,
      }),
      this.notificationsService.notify(manager, [trip.driverId], {
        type: 'request_cancelled',
        tripId: trip.id,
        requestId: request.id,
      }),
    ]);
  }
}
