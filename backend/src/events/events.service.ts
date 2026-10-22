import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import type { DomainEventType } from './domain-event-type';
import { DomainEvent } from './entities/domain-event.entity';

export interface RecordEventInput {
  type: DomainEventType;
  sourceEntityId: string;
  payload: Record<string, unknown>;
}

// Registro de eventos con el patrón outbox: el evento se guarda con el
// "manager" de la transacción en curso, es decir, en la MISMA transacción que
// el cambio que describe. O se guardan los dos o ninguno: nunca hay un cambio
// sin su evento ni un evento de un cambio que se deshizo
@Injectable()
export class EventsService {
  async record(
    manager: EntityManager,
    input: RecordEventInput,
  ): Promise<string> {
    const event = manager.create(DomainEvent, {
      id: randomUUID(),
      type: input.type,
      sourceEntityId: input.sourceEntityId,
      payload: input.payload,
    });
    await manager.save(event);
    return event.id;
  }
}
