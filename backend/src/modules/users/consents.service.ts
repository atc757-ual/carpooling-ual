import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import type {
  LegalDocument,
  LegalDocumentType,
  SignupDocumentType,
} from './entities/legal-document.entity';
import { UserConsent } from './entities/user-consent.entity';
import { LegalDocumentOutdatedError } from './errors/legal-document-outdated.error';
import {
  compareLegalVersions,
  LegalDocumentsService,
} from './legal-documents.service';
import { User } from './entities/user.entity';
import { UserNotFoundError } from './errors/user-not-found.error';
import {
  computeConsentFingerprint,
  computeContentHash,
  CONSENT_TYPES,
} from './user-consent';
import type {
  ConsentAction,
  ConsentSource,
  ConsentType,
  LocationConsentSource,
  UserConsentRecord,
  UserConsentsView,
} from './user-consent';

const INITIAL_CONSENT_TYPES: readonly ConsentType[] = ['terms', 'privacy'];

// La versión exacta de las condiciones o la política y el hash de su texto
interface DocumentReference {
  documentId: string | null;
  contentHash: string | null;
}

interface InsertConsentInput extends Partial<DocumentReference> {
  userId: string;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  source: ConsentSource;
  recordedAt: Date;
}

// Qué se acepta: el documento, la versión que vio (si no, la vigente) y desde
// dónde
export interface DocumentAcceptance {
  type: LegalDocumentType;
  version?: string;
  source?: Extract<ConsentSource, 'document_update' | 'driver_setup'>;
}

function referenceTo(document: LegalDocument): DocumentReference {
  return {
    documentId: document.id,
    contentHash: computeContentHash(document.content),
  };
}

@Injectable()
export class ConsentsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserConsent)
    private readonly consentsRepository: Repository<UserConsent>,
    private readonly eventsService: EventsService,
    private readonly legalDocuments: LegalDocumentsService,
  ) {}

  // Al registrarse y aceptar las condiciones y la política de privacidad,
  // deja una fila de cada tipo con la misma fecha de aceptación
  async recordInitialConsents(
    manager: EntityManager,
    userId: string,
    acceptedAt: Date,
  ): Promise<void> {
    const recordedAt = new Date(acceptedAt);
    const documents = await this.legalDocuments.currentDocuments();
    await Promise.all(
      INITIAL_CONSENT_TYPES.map((type) => {
        const document = documents[type as SignupDocumentType];
        return this.insertConsent(manager, {
          userId,
          type,
          documentVersion: document.version,
          ...referenceTo(document),
          action: 'granted',
          source: 'registration',
          recordedAt,
        });
      }),
    );
  }

  // Conceder o retirar el permiso de ubicación desde la app: el interruptor
  // del Perfil (settings), la ventana que explica para qué se usa
  // (location_prompt) o al detectar que se quitó el permiso del sistema
  // (device). Idempotente si el último estado registrado ya coincide
  async recordLocationConsent(
    userId: string,
    action: ConsentAction,
    source: LocationConsentSource = 'settings',
  ): Promise<UserConsentsView> {
    const privacy = await this.legalDocuments.getCurrent('privacy');
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
        documentVersion: privacy.version,
        action,
        source,
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
            documentId: latest.documentId,
            contentHash: latest.contentHash,
            action: 'revoked',
            source: 'account_deletion',
            recordedAt,
          });
        }
      }),
    );
  }

  // Los documentos que tiene que aceptar antes de seguir: aquellos cuyo
  // último cambio importante aún no ha aceptado (tras uno menor no se pide
  // nada). Se acepta siempre la versión vigente
  async pendingDocuments(
    userId: string,
  ): Promise<{ type: SignupDocumentType; version: string }[]> {
    const [{ current }, documents, termsRequired, privacyRequired] =
      await Promise.all([
        this.getMyConsents(userId),
        this.legalDocuments.currentDocuments(),
        this.legalDocuments.requiredVersion('terms'),
        this.legalDocuments.requiredVersion('privacy'),
      ]);
    const required = { terms: termsRequired, privacy: privacyRequired };
    return INITIAL_CONSENT_TYPES.flatMap((type) => {
      const documentType = type as SignupDocumentType;
      const accepted = current[type];
      const isAccepted =
        accepted?.action === 'granted' &&
        compareLegalVersions(
          accepted.documentVersion,
          required[documentType],
        ) >= 0;
      return isAccepted
        ? []
        : [{ type: documentType, version: documents[documentType].version }];
    });
  }

  // Acepta la versión vigente de un documento: una versión nueva de las
  // condiciones o la política (document_update) o la declaración del
  // conductor (driver_setup). Si se indica otra versión que la vigente,
  // LegalDocumentOutdatedError; aceptarla otra vez no cambia nada
  async acceptDocument(
    userId: string,
    acceptance: DocumentAcceptance,
  ): Promise<void> {
    const { type, source = 'document_update' } = acceptance;
    const current = await this.legalDocuments.getCurrent(type);
    const version = acceptance.version ?? current.version;
    if (current.version !== version) {
      throw new LegalDocumentOutdatedError(type);
    }
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, {
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (user?.deactivatedAt !== null) {
        throw new UserNotFoundError(userId);
      }
      const latest = await manager.findOne(UserConsent, {
        where: { userId, type },
        order: { recordedAt: 'DESC', id: 'DESC' },
      });
      if (latest?.action === 'granted' && latest.documentVersion === version) {
        return;
      }
      await this.insertConsent(manager, {
        userId,
        type,
        documentVersion: version,
        ...referenceTo(current),
        action: 'granted',
        source,
        recordedAt: new Date(),
      });
    });
  }

  // Si su última aceptación del documento está al día: concedida y no
  // anterior a su último cambio importante (p. ej. la declaración del
  // conductor para poder publicar)
  async isAccepted(userId: string, type: LegalDocumentType): Promise<boolean> {
    const [latest, required] = await Promise.all([
      this.consentsRepository.findOne({
        where: { userId, type },
        order: { recordedAt: 'DESC', id: 'DESC' },
      }),
      this.legalDocuments.requiredVersion(type),
    ]);
    return (
      latest?.action === 'granted' &&
      compareLegalVersions(latest.documentVersion, required) >= 0
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
      driver_declaration: null,
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
        documentId: input.documentId ?? null,
        contentHash: input.contentHash ?? null,
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
