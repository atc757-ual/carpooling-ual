import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventsService } from '../../events/events.service';
import type { MoveDirection } from './dto/admin-faq.dto';
import { FaqTopic } from './entities/faq-topic.entity';
import { FaqTopicNotFoundError } from './errors/faq-admin.errors';

export interface FaqTopicChanges {
  nameEs?: string;
  nameEn?: string;
  icon?: string;
}

// Los temas del centro de ayuda en el panel: son fijos (no se crean ni se
// borran); el administrador cambia sus nombres, su icono y su orden. Cada
// cambio deja su evento (faq_topic.updated) en la misma transacción
@Injectable()
export class AdminFaqTopicsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
  ) {}

  list(): Promise<FaqTopic[]> {
    return this.dataSource.manager.find(FaqTopic, {
      order: { sortOrder: 'ASC', key: 'ASC' },
    });
  }

  update(
    adminId: string,
    key: string,
    changes: FaqTopicChanges,
  ): Promise<FaqTopic> {
    return this.dataSource.transaction(async (manager) => {
      const topic = await this.lock(manager, key);
      Object.assign(
        topic,
        Object.fromEntries(
          Object.entries(changes).filter(([, value]) => value !== undefined),
        ),
      );
      return this.saveAndRecord(manager, adminId, topic);
    });
  }

  // Sube o baja un puesto (cambia el orden con su vecino); en el extremo no
  // cambia nada
  move(
    adminId: string,
    key: string,
    direction: MoveDirection,
  ): Promise<FaqTopic> {
    return this.dataSource.transaction(async (manager) => {
      const topic = await this.lock(manager, key);
      const isUp = direction === 'up';
      const neighbor = await manager
        .createQueryBuilder(FaqTopic, 'topic')
        .setLock('pessimistic_write')
        .where(isUp ? 'topic.sortOrder < :order' : 'topic.sortOrder > :order', {
          order: topic.sortOrder,
        })
        .orderBy('topic.sortOrder', isUp ? 'DESC' : 'ASC')
        .getOne();
      if (neighbor === null) {
        return topic;
      }
      [topic.sortOrder, neighbor.sortOrder] = [
        neighbor.sortOrder,
        topic.sortOrder,
      ];
      await this.saveAndRecord(manager, adminId, neighbor);
      return this.saveAndRecord(manager, adminId, topic);
    });
  }

  private async lock(manager: EntityManager, key: string): Promise<FaqTopic> {
    const topic = await manager.findOne(FaqTopic, {
      where: { key },
      lock: { mode: 'pessimistic_write' },
    });
    if (topic === null) {
      throw new FaqTopicNotFoundError(key);
    }
    return topic;
  }

  private async saveAndRecord(
    manager: EntityManager,
    adminId: string,
    topic: FaqTopic,
  ): Promise<FaqTopic> {
    const saved = await manager.save(FaqTopic, topic);
    await this.events.record(manager, {
      type: 'faq_topic.updated',
      sourceEntityId: saved.id,
      payload: {
        key: saved.key,
        nameEs: saved.nameEs,
        nameEn: saved.nameEn,
        icon: saved.icon,
        sortOrder: saved.sortOrder,
        adminId,
      },
    });
    return saved;
  }
}
