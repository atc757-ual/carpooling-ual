import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Not, Repository } from 'typeorm';
import type { FindOptionsWhere } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { Notification } from './entities/notification.entity';
import type { NotificationType } from './entities/notification.entity';
import { NotificationNotFoundError } from './errors/notification-not-found.error';

// Qué se avisa: el tipo y a qué se refiere. La base de datos exige la
// incidencia en incident_reported y la solicitud en los demás
export interface NotificationContent {
  type: NotificationType;
  tripId: string;
  requestId?: string;
  incidentId?: string;
}

// Avisos dentro de la aplicación (RF-19, CU-11). Los crean los módulos donde
// ocurre cada cambio (solicitudes, viajes, incidencias), que son los que saben
// quién lo hizo y a quién avisar; este módulo no depende de ninguno de ellos
@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
  ) {}

  // Avisa a varios usuarios con el manager de la transacción del cambio: si
  // el cambio se deshace, el aviso también. Cada destinatario, una sola vez
  async notify(
    manager: EntityManager,
    recipientIds: readonly string[],
    content: NotificationContent,
  ): Promise<void> {
    const recipients = [...new Set(recipientIds)];
    if (recipients.length === 0) {
      return;
    }
    await manager.insert(
      Notification,
      recipients.map((userId) => ({
        userId,
        type: content.type,
        tripId: content.tripId,
        requestId: content.requestId ?? null,
        incidentId: content.incidentId ?? null,
      })),
    );
  }

  // Mis avisos, los más recientes primero; con isRead, solo los leídos o los
  // no leídos (el total de los no leídos es el contador del frontend)
  async listForUser(
    userId: string,
    isRead: boolean | undefined,
    page: PageRequest,
  ): Promise<Page<Notification>> {
    const where: FindOptionsWhere<Notification> = { userId };
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
