import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import {
  LEGAL_NOTIFICATION_TYPES,
  Notification,
  type LegalNotificationType,
  type TripNotificationType,
} from './entities/notification.entity';
import { NotificationNotFoundError } from './errors/notification-not-found.error';
import { PushService } from '../push/push.service';
import { toPushMessage } from './notification-pushes';
import type { NotificationCategory } from './dto/list-notifications-query.dto';

// Qué se avisa: el tipo y a qué se refiere. Los de un viaje llevan el viaje
// (la base de datos exige la incidencia en incident_reported y la solicitud en
// los demás); los de un documento legal, solo la versión publicada
export type NotificationContent =
  | {
      type: TripNotificationType;
      tripId: string;
      requestId?: string;
      incidentId?: string;
    }
  | { type: LegalNotificationType; legalDocumentId: string };

// Avisos dentro de la aplicación (RF-19, CU-11). Los crean los módulos donde
// ocurre cada cambio (solicitudes, viajes, incidencias), que son los que saben
// quién lo hizo y a quién avisar; este módulo no depende de ninguno de ellos
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly push: PushService,
  ) {}

  // Avisa a varios usuarios con el manager de la transacción del cambio: si
  // el cambio se deshace, el aviso también. Cada destinatario, una sola vez.
  // Los importantes de un viaje van además por push (al confirmarse)
  async notify(
    manager: EntityManager,
    recipientIds: readonly string[],
    content: NotificationContent,
  ): Promise<void> {
    const recipients = [...new Set(recipientIds)];
    if (recipients.length === 0) {
      return;
    }
    const references = toReferences(content);
    const push = toPushMessage(content);
    if (push) {
      this.push.queue(manager, recipients, push);
    }
    await manager.insert(
      Notification,
      recipients.map((userId) => ({
        userId,
        type: content.type,
        ...references,
      })),
    );
  }

  // Mis avisos, los más recientes primero; con isRead, solo los leídos o los
  // no leídos (el total de los no leídos es el contador del frontend)
  async listForUser(
    userId: string,
    isRead: boolean | undefined,
    page: PageRequest & { category?: NotificationCategory },
  ): Promise<Page<Notification>> {
    const where: FindOptionsWhere<Notification> = { userId };
    if (page.category === 'account') {
      where.type = In([...LEGAL_NOTIFICATION_TYPES]);
    } else if (page.category === 'incident') {
      where.type = 'incident_reported';
    } else if (page.category === 'travel') {
      where.type = In([
        'request_received',
        'request_accepted',
        'request_rejected',
        'request_cancelled',
        'request_conflict_cancelled',
        'trip_cancelled',
        'passenger_left',
        'trip_started',
        'review_requested',
        'request_expired',
        'passenger_no_show',
      ]);
    }
    if (isRead !== undefined) {
      where.readAt = isRead ? Not(IsNull()) : IsNull();
    }
    const [items, total] = await this.notificationsRepository.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  // Marca un aviso propio como leído. Si ya lo estaba, conserva la fecha de
  // la primera lectura
  async markRead(userId: string, id: string): Promise<Notification> {
    const notification = await this.notificationsRepository.findOneBy({
      id,
      userId,
    });
    if (notification === null) {
      throw new NotificationNotFoundError(id);
    }
    if (notification.readAt === null) {
      notification.readAt = new Date();
      await this.notificationsRepository.update(id, {
        readAt: notification.readAt,
      });
    }
    return notification;
  }

  // Marca como leídos todos mis avisos pendientes de leer
  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }
}

// Las referencias de cada aviso: las de un viaje o la versión de un documento
function toReferences(
  content: NotificationContent,
): Pick<
  Notification,
  'tripId' | 'requestId' | 'incidentId' | 'legalDocumentId'
> {
  if ('legalDocumentId' in content) {
    return {
      tripId: null,
      requestId: null,
      incidentId: null,
      legalDocumentId: content.legalDocumentId,
    };
  }
  return {
    tripId: content.tripId,
    requestId: content.requestId ?? null,
    incidentId: content.incidentId ?? null,
    legalDocumentId: null,
  };
}
