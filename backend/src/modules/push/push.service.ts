import { Injectable, Logger } from '@nestjs/common';
import {
  DataSource,
  EntityManager,
  EntitySubscriberInterface,
  TransactionCommitEvent,
  TransactionRollbackEvent,
} from 'typeorm';
import { AfterCommitQueue } from '../../shared/database/after-commit-queue';
import type { AppLanguage } from '../../shared/i18n/app-language';
import { PushMessage, PushSender } from '../../shared/push/push-sender';
import { PushTokensService } from './push-tokens.service';

// La misma push en cada idioma de la app: cada dispositivo recibe la del
// suyo
export type LocalizedPushMessage = Record<AppLanguage, PushMessage>;

interface PendingPush {
  userIds: readonly string[];
  message: LocalizedPushMessage;
}

// Notificaciones push de lo importante de un viaje (las elige quien avisa:
// avisos de notifications y mensajes del chat). Se apuntan en la transacción
// del cambio y solo se envían si se confirma: si el cambio se deshace, no sale
// ninguna. Un fallo al enviar nunca rompe el cambio (los avisos dentro de la
// app ya están guardados)
@Injectable()
export class PushService implements EntitySubscriberInterface {
  private readonly logger = new Logger(PushService.name);
  private readonly pending = new AfterCommitQueue<PendingPush>('pendingPushes');

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
    message: LocalizedPushMessage,
  ): void {
    if (userIds.length === 0) {
      return;
    }
    if (!this.pending.add(manager, { userIds, message })) {
      void this.deliver({ userIds, message });
    }
  }

  afterTransactionCommit({ queryRunner }: TransactionCommitEvent): void {
    for (const push of this.pending.take(queryRunner)) {
      void this.deliver(push);
    }
  }

  afterTransactionRollback({ queryRunner }: TransactionRollbackEvent): void {
    this.pending.take(queryRunner);
  }

  // A cada dispositivo, en su idioma. Los tokens que ya no valen se borran
  async deliver({ userIds, message }: PendingPush): Promise<void> {
    try {
      const byLanguage = await this.tokens.recipientsByLanguage(userIds);
      const invalid = await Promise.all(
        [...byLanguage].map(([language, recipients]) =>
          this.sender.send(recipients, message[language]),
        ),
      );
      await this.tokens.removeInvalid(invalid.flat());
    } catch (error) {
      this.logger.warn(
        `No se pudo enviar una push: ${(error as Error).message}`,
      );
    }
  }
}
