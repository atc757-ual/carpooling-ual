import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, MoreThan, Repository } from 'typeorm';
import { Page, PageRequest } from '../shared/pagination/page';
import type { DomainEventType } from './domain-event-type';
import { DomainEvent } from './entities/domain-event.entity';
import { EventNotFoundError } from './errors/event-not-found.error';
import { EVENT_VERSIONS } from './event-versions';

export interface RecordEventInput {
  type: DomainEventType;
  sourceEntityId: string;
  payload: Record<string, unknown>;
}

// Cuántos eventos devuelve como mucho una lectura
export const MAX_EVENTS_PER_READ = 500;

// Registro de eventos con el patrón outbox: el evento se guarda con el
// "manager" de la transacción en curso, es decir, en la MISMA transacción que
// el cambio que describe. O se guardan los dos o ninguno: nunca hay un cambio
// sin su evento ni un evento de un cambio que se deshizo
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(DomainEvent)
    private readonly eventsRepository: Repository<DomainEvent>,
  ) {}

  async record(
    manager: EntityManager,
    input: RecordEventInput,
  ): Promise<string> {
    const event = manager.create(DomainEvent, {
      id: randomUUID(),
      type: input.type,
      version: EVENT_VERSIONS[input.type],
      sourceEntityId: input.sourceEntityId,
      payload: input.payload,
    });
    await manager.save(event);
    return event.id;
  }

  // Los eventos posteriores a una secuencia, en orden: lo que lee el Gemelo
  // Digital (único consumidor) desde el último que procesó. La secuencia se
  // pone al guardar, no al confirmar: dos transacciones simultáneas pueden
  // confirmarse en otro orden, así que el consumidor debe volver a mirar los
  // huecos que encuentre antes de darlos por perdidos (docs/api/events.md)
  readAfter(
    sequence: number,
    limit = MAX_EVENTS_PER_READ,
  ): Promise<DomainEvent[]> {
    return this.eventsRepository.find({
      where: { sequence: MoreThan(sequence) },
      order: { sequence: 'ASC' },
      take: Math.min(Math.max(limit, 1), MAX_EVENTS_PER_READ),
    });
  }

  // Los últimos eventos para el panel (el más reciente primero), con filtro
  // opcional por tipo
  async list(
    filter: { type?: DomainEventType },
    page: PageRequest,
  ): Promise<Page<DomainEvent>> {
    const [items, total] = await this.eventsRepository.findAndCount({
      where: filter.type === undefined ? {} : { type: filter.type },
      order: { sequence: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  // Los eventos de varias entidades (p. ej. un viaje y sus solicitudes) en
  // el orden en que pasaron, como mucho MAX_EVENTS_PER_READ
  listBySources(sourceEntityIds: readonly string[]): Promise<DomainEvent[]> {
    return this.eventsRepository.find({
      where: { sourceEntityId: In([...sourceEntityIds]) },
      order: { sequence: 'ASC' },
      take: MAX_EVENTS_PER_READ,
    });
  }

  async get(eventId: string): Promise<DomainEvent> {
    const event = await this.eventsRepository.findOneBy({ id: eventId });
    if (event === null) {
      throw new EventNotFoundError(eventId);
    }
    return event;
  }
}
