import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import type { Page, PageRequest } from '../../shared/pagination/page';
import type { MoveDirection } from './dto/admin-faq.dto';
import { FaqTopic } from './entities/faq-topic.entity';
import { Faq } from './entities/faq.entity';
import {
  FaqPublishedNotDeletableError,
  FaqTopicNotFoundError,
  FaqTranslationMissingError,
  InvalidFaqTransitionError,
} from './errors/faq-admin.errors';
import { FaqNotFoundError } from './errors/faq-not-found.error';
import { canChangeFaqStatus, isFaqTranslated } from './faq-status';
import type { FaqAudience, FaqContext, FaqStatus } from './faq-values';
import { escapeLike } from './faqs.service';

export interface AdminFaqFilters {
  topic?: string;
  status?: FaqStatus;
  q?: string;
}

export interface FaqFields {
  topic: string;
  audience: FaqAudience;
  quickContexts?: FaqContext[];
  questionEs: string;
  questionEn?: string;
  answerEs: string;
  answerEn?: string;
  pointsEs?: string[];
  pointsEn?: string[];
}

// Los textos de los dos idiomas, para buscar desde el panel
const SEARCH_TEXT = `faq.question_es || ' ' || faq.answer_es || ' ' || faq.question_en || ' ' || faq.answer_en`;

// Gestión de las preguntas frecuentes desde el panel: el administrador las ve
// todas, las crea como borrador, las cambia, las publica o las devuelve a
// borrador, las ordena dentro de su tema y borra los borradores. Cada cambio
// bloquea la fila y deja su evento (faq.*) en la misma transacción
@Injectable()
export class AdminFaqsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
  ) {}

  async list(filters: AdminFaqFilters, page: PageRequest): Promise<Page<Faq>> {
    const query = this.dataSource.manager
      .createQueryBuilder(Faq, 'faq')
      .innerJoinAndSelect('faq.topic', 'topic');
    if (filters.topic !== undefined) {
      query.andWhere('topic.key = :topic', { topic: filters.topic });
    }
    if (filters.status !== undefined) {
      query.andWhere('faq.status = :status', { status: filters.status });
    }
    if (filters.q !== undefined) {
      query.andWhere(`unaccent(${SEARCH_TEXT}) ILIKE unaccent(:pattern)`, {
        pattern: `%${escapeLike(filters.q)}%`,
      });
    }
    const [items, total] = await query
      .orderBy('topic.sortOrder', 'ASC')
      .addOrderBy('faq.sortOrder', 'ASC')
      .addOrderBy('faq.id', 'ASC')
      .skip(page.offset)
      .take(page.limit)
      .getManyAndCount();
    return { items, total };
  }

  // Como borrador, al final de su tema
  create(adminId: string, fields: FaqFields): Promise<Faq> {
    return this.dataSource.transaction(async (manager) => {
      const topic = await this.lockTopic(manager, fields.topic);
      const faq = manager.create(Faq, {
        topicId: topic.id,
        topic,
        sortOrder: await this.nextOrder(manager, topic.id),
        audience: fields.audience,
        quickContexts: fields.quickContexts ?? [],
        questionEs: fields.questionEs,
        questionEn: fields.questionEn ?? '',
        answerEs: fields.answerEs,
        answerEn: fields.answerEn ?? '',
        pointsEs: fields.pointsEs ?? [],
        pointsEn: fields.pointsEn ?? [],
        status: 'draft',
      });
      return this.saveAndRecord(manager, adminId, faq, 'faq.created');
    });
  }

  // Cambia lo enviado. Al cambiar de tema pasa al final del nuevo. Una
  // publicada no puede quedarse sin su texto en inglés
  update(
    adminId: string,
    id: string,
    changes: Partial<FaqFields>,
  ): Promise<Faq> {
    return this.dataSource.transaction(async (manager) => {
      const faq = await this.lock(manager, id);
      const { topic: topicKey, ...texts } = changes;
      Object.assign(
        faq,
        Object.fromEntries(
          Object.entries(texts).filter(([, value]) => value !== undefined),
        ),
      );
      if (topicKey !== undefined && topicKey !== faq.topic.key) {
        const topic = await this.lockTopic(manager, topicKey);
        faq.topic = topic;
        faq.topicId = topic.id;
        faq.sortOrder = await this.nextOrder(manager, topic.id);
      }
      if (faq.status === 'published' && !isFaqTranslated(faq)) {
        throw new FaqTranslationMissingError(id);
      }
      return this.saveAndRecord(manager, adminId, faq, 'faq.updated');
    });
  }

  // Publica un borrador (completo en los dos idiomas) o devuelve a borrador
  // una publicada
  changeStatus(adminId: string, id: string, to: FaqStatus): Promise<Faq> {
    return this.dataSource.transaction(async (manager) => {
      const faq = await this.lock(manager, id);
      if (!canChangeFaqStatus(faq.status, to)) {
        throw new InvalidFaqTransitionError(faq.status, to);
      }
      if (to === 'published' && !isFaqTranslated(faq)) {
        throw new FaqTranslationMissingError(id);
      }
      faq.status = to;
      const type = to === 'published' ? 'faq.published' : 'faq.unpublished';
      return this.saveAndRecord(manager, adminId, faq, type);
    });
  }

  // Sube o baja un puesto dentro de su tema (cambia el orden con su vecina);
  // en el extremo no cambia nada
  move(adminId: string, id: string, direction: MoveDirection): Promise<Faq> {
    return this.dataSource.transaction(async (manager) => {
      const faq = await this.lock(manager, id);
      const isUp = direction === 'up';
      const neighbor = await manager
        .createQueryBuilder(Faq, 'faq')
        .setLock('pessimistic_write')
        .where('faq.topicId = :topicId', { topicId: faq.topicId })
        .andWhere(isUp ? 'faq.sortOrder < :order' : 'faq.sortOrder > :order', {
          order: faq.sortOrder,
        })
        .orderBy('faq.sortOrder', isUp ? 'DESC' : 'ASC')
        .getOne();
      if (neighbor === null) {
        return faq;
      }
      [faq.sortOrder, neighbor.sortOrder] = [neighbor.sortOrder, faq.sortOrder];
      neighbor.topic = faq.topic;
      await this.saveAndRecord(manager, adminId, neighbor, 'faq.updated');
      return this.saveAndRecord(manager, adminId, faq, 'faq.updated');
    });
  }

  // Solo un borrador: una publicada primero se pasa a borrador
  async remove(adminId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const faq = await this.lock(manager, id);
      if (faq.status === 'published') {
        throw new FaqPublishedNotDeletableError(id);
      }
      await this.record(manager, adminId, faq, 'faq.deleted');
      await manager.delete(Faq, { id });
    });
  }

  // Bloquea la pregunta y le pone su tema (el bloqueo no admite el join)
  private async lock(manager: EntityManager, id: string): Promise<Faq> {
    const faq = await manager.findOne(Faq, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
    });
    if (faq === null) {
      throw new FaqNotFoundError(id);
    }
    faq.topic = await manager.findOneByOrFail(FaqTopic, { id: faq.topicId });
    return faq;
  }

  // Bloquea el tema: dos altas a la vez no se quedan con el mismo puesto
  private async lockTopic(
    manager: EntityManager,
    key: string,
  ): Promise<FaqTopic> {
    const topic = await manager.findOne(FaqTopic, {
      where: { key },
      lock: { mode: 'pessimistic_write' },
    });
    if (topic === null) {
      throw new FaqTopicNotFoundError(key);
    }
    return topic;
  }

  private async nextOrder(
    manager: EntityManager,
    topicId: string,
  ): Promise<number> {
    const last = await manager.maximum(Faq, 'sortOrder', { topicId });
    return (last ?? 0) + 1;
  }

  private async saveAndRecord(
    manager: EntityManager,
    adminId: string,
    faq: Faq,
    type: DomainEventType,
  ): Promise<Faq> {
    const saved = await manager.save(Faq, faq);
    await this.record(manager, adminId, saved, type);
    return saved;
  }

  private record(
    manager: EntityManager,
    adminId: string,
    faq: Faq,
    type: DomainEventType,
  ): Promise<string> {
    return this.events.record(manager, {
      type,
      sourceEntityId: faq.id,
      payload: {
        topic: faq.topic.key,
        sortOrder: faq.sortOrder,
        audience: faq.audience,
        quickContexts: faq.quickContexts,
        questionEs: faq.questionEs,
        status: faq.status,
        adminId,
      },
    });
  }
}
