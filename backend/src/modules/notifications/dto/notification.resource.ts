import { ApiProperty } from '@nestjs/swagger';
import { incidentHref } from '../../incidents/dto/incident.resource';
import { requestHref } from '../../requests/dto/seat-request.resource';
import { tripHref } from '../../trips/dto/trip.resource';
import { NOTIFICATION_TYPES } from '../entities/notification.entity';
import type {
  Notification,
  NotificationType,
} from '../entities/notification.entity';

// Enlace a lo que se refiere el aviso, para abrirlo desde el frontend
export class NotificationLinkResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;
}

// Recurso TMF630 Notification: un aviso dentro de la aplicación (RF-19). Sin
// texto: el frontend compone la frase a partir del tipo. Sin href propio: no
// hay GET de un aviso suelto
export class NotificationResource {
  @ApiProperty({ enum: ['Notification'] })
  '@type': 'Notification';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    enum: NOTIFICATION_TYPES,
    description:
      'request_received (to the driver), request_accepted, request_rejected, request_conflict_cancelled and trip_cancelled (to the passenger), request_cancelled and passenger_left (to the driver), incident_reported (to the administrators)',
  })
  type: NotificationType;

  @ApiProperty({ type: NotificationLinkResource })
  trip: NotificationLinkResource;

  @ApiProperty({
    type: NotificationLinkResource,
    nullable: true,
    description: 'The seat request; null in incident_reported',
  })
  request: NotificationLinkResource | null;

  @ApiProperty({
    type: NotificationLinkResource,
    nullable: true,
    description: 'The incident; only in incident_reported',
  })
  incident: NotificationLinkResource | null;

  @ApiProperty()
  isRead: boolean;

  @ApiProperty({ format: 'date-time', nullable: true })
  readAt: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export function toNotificationResource(
  notification: Notification,
): NotificationResource {
  const { requestId, incidentId, readAt } = notification;
  return {
    '@type': 'Notification',
    id: notification.id,
    type: notification.type,
    trip: { id: notification.tripId, href: tripHref(notification.tripId) },
    request:
      requestId === null
        ? null
        : { id: requestId, href: requestHref(requestId) },
    incident:
      incidentId === null
        ? null
        : { id: incidentId, href: incidentHref(incidentId) },
    isRead: readAt !== null,
    readAt: readAt === null ? null : readAt.toISOString(),
    createdAt: notification.createdAt.toISOString(),
  };
}
