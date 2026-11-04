import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  QueryRunner,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { PushMessage, PushSender } from '../../shared/push/push-sender';
import { PushTokensService } from './push-tokens.service';

// Clave en los datos del QueryRunner de la transacción
const PENDING_KEY = 'pendingPushes';

interface PendingPush {
  userIds: readonly string[];
  message: PushMessage;
}

// Notificaciones push de lo importante de un viaje (las elige quien avisa:
// avisos de notifications y mensajes del chat). Se apuntan en la transacción
// del cambio y solo se envían si se confirma: si el cambio se deshace, no sale
// ninguna. Un fallo al enviar nunca rompe el cambio (los avisos dentro de la
// app ya están guardados)
@Injectable()
export class PushService implements EntitySubscriberInterface {
  private readonly logger = new Logger(PushService.name);

  constructor(
    dataSource: DataSource,
    private readonly tokens: PushTokensService,
    private readonly sender: PushSender,
  ) {
    dataSource.subscribers.push(this);
  }

  // Dentro de una transacción, se envía al confirmarla; fuera, al momento
  queue(
    manager: EntityManager,
    userIds: readonly string[],
    message: PushMessage,
  ): void {
    if (userIds.length === 0) {
      return;
    }
    const queryRunner = manager.queryRunner;
    if (!queryRunner?.isTransactionActive) {
      void this.deliver({ userIds, message });
      return;
    }
    pendingOf(queryRunner).push({ userIds, message });
  }

  afterTransactionCommit({ queryRunner }: TransactionCommitEvent): void {
    const pending = takePending(queryRunner);
    for (const push of pending) {
      void this.deliver(push);
    }
  }

  afterTransactionRollback({ queryRunner }: TransactionRollbackEvent): void {
    takePending(queryRunner);
  }

  // Los tokens que ya no valen se borran
  async deliver({ userIds, message }: PendingPush): Promise<void> {
    try {
      const recipients = await this.tokens.recipientsOf(userIds);
      if (recipients.tokens.length === 0 && recipients.fids.length === 0) {
        return;
      }
      const invalid = await this.sender.send(recipients, message);
      await this.tokens.removeInvalid(invalid);
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar una push: ${(error as Error).message}`,
      );
    }
  }
}

function pendingOf(queryRunner: QueryRunner): PendingPush[] {
  const data = queryRunner.data as Record<string, unknown>;
  const pending = (data[PENDING_KEY] as PendingPush[] | undefined) ?? [];
  data[PENDING_KEY] = pending;
  return pending;
}

function takePending(queryRunner: QueryRunner): PendingPush[] {
  const data = queryRunner.data as Record<string, unknown>;
  const pending = (data[PENDING_KEY] as PendingPush[] | undefined) ?? [];
  delete data[PENDING_KEY];
  return pending;
}
