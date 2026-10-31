import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { UserConsent } from './entities/user-consent.entity';
import { User } from './entities/user.entity';
import { UserNotFoundError } from './errors/user-not-found.error';
import {
  computeConsentFingerprint,
  CONSENT_DOCUMENT_VERSION,
  CONSENT_TYPES,
} from './user-consent';
import type {
  ConsentAction,
  ConsentSource,
  ConsentType,
  UserConsentRecord,
  UserConsentsView,
} from './user-consent';

const INITIAL_CONSENT_TYPES: readonly ConsentType[] = ['terms', 'privacy'];

interface InsertConsentInput {
  userId: string;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  source: ConsentSource;
  recordedAt: Date;
}

@Injectable()
export class ConsentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserConsent)
    private readonly consentsRepository: Repository<UserConsent>,
    private readonly eventsService: EventsService,
  ) {}

  // Al registrarse y aceptar las condiciones y la política de privacidad,
  // deja una fila de cada tipo con la misma fecha de aceptación
  async recordInitialConsents(
    manager: EntityManager,
    userId: string,
    acceptedAt: Date,
  ): Promise<void> {
    const recordedAt = new Date(acceptedAt.getTime());
    for (const type of INITIAL_CONSENT_TYPES) {
      await this.insertConsent(manager, {
        userId,
        type,
        documentVersion: CONSENT_DOCUMENT_VERSION,
        action: 'granted',
        source: 'registration',
        recordedAt,
      });
    }
  }

  // Conceder o retirar el permiso de ubicación desde la app (ajustes/perfil).
  // Idempotente si el último estado registrado ya coincide con el pedido
  async recordLocationConsent(
    userId: string,
    action: ConsentAction,
  ): Promise<UserConsentsView> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user?.deactivatedAt !== null) {
        throw new UserNotFoundError(userId);
      }
      const latest = await manager.findOne(UserConsent, {
        where: { userId, type: 'location' },
        order: { recordedAt: 'DESC', id: 'DESC' },
      });
      if (latest?.action === action) {
        return;
      }
      await this.insertConsent(manager, {
        userId,
        type: 'location',
        documentVersion: CONSENT_DOCUMENT_VERSION,
        action,
        source: 'settings',
        recordedAt: new Date(),
      });
    });
    return this.getMyConsents(userId);
  }

  // Al eliminar la cuenta, registra en user_consents la retirada de cada
  // consentimiento que estuviera concedido (source account_deletion)
  async revokeGrantedOnAccountDeletion(
    manager: EntityManager,
    userId: string,
    recordedAt = new Date(),
  ): Promise<void> {
    await Promise.all(
      CONSENT_TYPES.map(async (type) => {
        const latest = await manager.findOne(UserConsent, {
          where: { userId, type },
          order: { recordedAt: 'DESC', id: 'DESC' },
        });
        if (latest?.action === 'granted') {
          await this.insertConsent(manager, {
            userId,
            type,
            documentVersion: latest.documentVersion,
            action: 'revoked',
            source: 'account_deletion',
            recordedAt,
          });
        }
      }),
    );
  }

  async getMyConsents(userId: string): Promise<UserConsentsView> {
    const exists = await this.dataSource
      .getRepository(User)
      .existsBy({ id: userId, deactivatedAt: IsNull() });
    if (!exists) {
      throw new UserNotFoundError(userId);
    }
    const rows = await this.consentsRepository.find({
      where: { userId },
      order: { recordedAt: 'DESC', id: 'DESC' },
    });
    const history = rows.map(toConsentRecord);
    const current: Record<ConsentType, UserConsentRecord | null> = {
      terms: null,
      privacy: null,
      location: null,
    };
    for (const type of CONSENT_TYPES) {
      current[type] = history.find((item) => item.type === type) ?? null;
    }
    return { current, history };
  }

  private async insertConsent(
    manager: EntityManager,
    input: InsertConsentInput,
  ): Promise<UserConsent> {
    const fingerprint = computeConsentFingerprint(input);
    const saved = await manager.save(
      manager.create(UserConsent, {
        userId: input.userId,
        type: input.type,
        documentVersion: input.documentVersion,
        action: input.action,
        source: input.source,
        recordedAt: input.recordedAt,
        fingerprint,
      }),
    );
    await this.eventsService.record(manager, {
      type: input.action === 'granted' ? 'consent.granted' : 'consent.revoked',
      sourceEntityId: input.userId,
      payload: {
        consentId: saved.id,
        type: saved.type,
        documentVersion: saved.documentVersion,
        source: saved.source,
        fingerprint: saved.fingerprint,
      },
    });
    return saved;
  }
}

function toConsentRecord(entity: UserConsent): UserConsentRecord {
  return {
    id: entity.id,
    type: entity.type,
    documentVersion: entity.documentVersion,
    action: entity.action,
    source: entity.source,
    recordedAt: entity.recordedAt,
    fingerprint: entity.fingerprint,
  };
}
