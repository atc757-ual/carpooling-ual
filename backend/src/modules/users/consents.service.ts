import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
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
  CURRENT_CONSENT_TYPES,
} from './user-consent';
import type {
  ConsentAction,
  ConsentSource,
  ConsentType,
  CurrentConsentType,
  LocationConsentSource,
  UserConsentRecord,
  UserConsentsView,
} from './user-consent';

// Las declaraciones del conductor y de cada vehículo se renuevan cada año:
// pasado ese tiempo desde su última aceptación, dejan de estar al día
const DECLARATION_TYPES: ReadonlySet<ConsentType> = new Set([
  'driver_declaration',
  'vehicle_declaration',
]);
const DECLARATION_VALIDITY_MONTHS = 12;

const INITIAL_CONSENT_TYPES: readonly CurrentConsentType[] = [
  'terms',
  'privacy',
];

// La versión exacta de las condiciones o la política y el hash de su texto
interface DocumentReference {
  documentId: string | null;
  contentHash: string | null;
}

interface InsertConsentInput extends Partial<DocumentReference> {
  userId: string;
  vehicleId?: string | null;
  type: ConsentType;
  documentVersion: string;
  action: ConsentAction;
  source: ConsentSource;
  recordedAt: Date;
}

// Conceder o retirar el consentimiento de ubicación; al concederlo, la
// versión de su documento que vio (si no, la vigente)
export interface LocationConsentChange {
  action: ConsentAction;
  source?: LocationConsentSource;
  version?: string;
}

// Qué se acepta: el documento, la versión que vio (si no, la vigente) y desde
// dónde
export interface DocumentAcceptance {
  type: LegalDocumentType;
  version?: string;
  source?: Extract<
    ConsentSource,
    'document_update' | 'driver_setup' | 'vehicle_setup'
  >;
  // La declaración de un vehículo va unida a él
  vehicleId?: string;
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

  // Conceder o retirar el consentimiento de ubicación desde la app: el
  // interruptor del Perfil (settings), la ventana que explica para qué se usa
  // (location_prompt) o al detectar que se quitó el permiso del sistema
  // (device). Se concede la versión vigente de su documento (si se indica otra,
  // LegalDocumentOutdatedError) y se retira la última concedida. Idempotente
  // si el último estado registrado ya coincide
  async recordLocationConsent(
    userId: string,
    change: LocationConsentChange,
  ): Promise<UserConsentsView> {
    const { action, source = 'settings' } = change;
    const document = await this.legalDocuments.getCurrent('location');
    if (
      action === 'granted' &&
      change.version !== undefined &&
      change.version !== document.version
    ) {
      throw new LegalDocumentOutdatedError('location');
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
        where: { userId, type: 'location' },
        order: { recordedAt: 'DESC', id: 'DESC' },
      });
      const isGranted =
        latest?.action === 'granted' &&
        latest.documentVersion === document.version;
      if (
        (action === 'granted' && isGranted) ||
        (action === 'revoked' && latest?.action === 'revoked')
      ) {
        return;
      }
      const reference =
        action === 'granted' || latest === null
          ? { documentVersion: document.version, ...referenceTo(document) }
          : {
              documentVersion: latest.documentVersion,
              documentId: latest.documentId,
              contentHash: latest.contentHash,
            };
      await this.insertConsent(manager, {
        userId,
        type: 'location',
        ...reference,
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
      // Las de cada vehículo no: van con el vehículo, que deja de usarse
      CURRENT_CONSENT_TYPES.map(async (type) => {
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
  // condiciones o la política (document_update), la declaración del
  // conductor (driver_setup) o la de un vehículo (vehicle_setup). Si se indica otra versión que la vigente,
  // LegalDocumentOutdatedError; aceptarla otra vez no cambia nada
  async acceptDocument(
    userId: string,
    acceptance: DocumentAcceptance,
  ): Promise<void> {
    const { type, vehicleId, source = 'document_update' } = acceptance;
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
        where: { userId, type, ...(vehicleId ? { vehicleId } : {}) },
        order: { recordedAt: 'DESC', id: 'DESC' },
      });
      // Repetirla no cambia nada, salvo para renovar una declaración caducada
      if (isUpToDate(latest, version)) {
        return;
      }
      await this.insertConsent(manager, {
        userId,
        type,
        vehicleId: vehicleId ?? null,
        documentVersion: version,
        ...referenceTo(current),
        action: 'granted',
        source,
        recordedAt: new Date(),
      });
    });
  }

  // Si su última aceptación del documento está al día: concedida, no
  // anterior a su último cambio importante y, en las declaraciones, de hace
  // menos de un año (p. ej. la del conductor para poder publicar)
  async isAccepted(userId: string, type: LegalDocumentType): Promise<boolean> {
    const [latest, required] = await Promise.all([
      this.consentsRepository.findOne({
        where: { userId, type },
        order: { recordedAt: 'DESC', id: 'DESC' },
      }),
      this.legalDocuments.requiredVersion(type),
    ]);
    return isUpToDate(latest, required);
  }

  // La versión de su última aceptación si está al día (la que vale al
  // iniciar un viaje); null si no lo está. vehicleId: la de ese vehículo
  async acceptedVersion(
    userId: string,
    type: LegalDocumentType,
    vehicleId?: string,
  ): Promise<string | null> {
    const [latest, required] = await Promise.all([
      this.consentsRepository.findOne({
        where: { userId, type, ...(vehicleId ? { vehicleId } : {}) },
        order: { recordedAt: 'DESC', id: 'DESC' },
      }),
      this.legalDocuments.requiredVersion(type),
    ]);
    return latest && isUpToDate(latest, required)
      ? latest.documentVersion
      : null;
  }

  // De esos vehículos suyos, los que tienen la declaración al día (una sola
  // consulta para toda la lista)
  async acceptedVehicleIds(
    userId: string,
    vehicleIds: readonly string[],
  ): Promise<Set<string>> {
    if (vehicleIds.length === 0) {
      return new Set();
    }
    const [rows, required] = await Promise.all([
      this.consentsRepository.find({
        where: {
          userId,
          type: 'vehicle_declaration',
          vehicleId: In([...vehicleIds]),
        },
        order: { recordedAt: 'DESC', id: 'DESC' },
      }),
      this.legalDocuments.requiredVersion('vehicle_declaration'),
    ]);
    const latest = new Map<string, UserConsent>();
    for (const row of rows) {
      if (row.vehicleId !== null && !latest.has(row.vehicleId)) {
        latest.set(row.vehicleId, row);
      }
    }
    return new Set(
      [...latest]
        .filter(([, consent]) => isUpToDate(consent, required))
        .map(([vehicleId]) => vehicleId),
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
    const current: Record<CurrentConsentType, UserConsentRecord | null> = {
      terms: null,
      privacy: null,
      location: null,
      driver_declaration: null,
    };
    for (const type of CURRENT_CONSENT_TYPES) {
      current[type] = history.find((item) => item.type === type) ?? null;
    }
    return { current, outdated: await this.outdatedTypes(current), history };
  }

  // De los concedidos, los anteriores al último cambio importante de su
  // documento
  private async outdatedTypes(
    current: Record<CurrentConsentType, UserConsentRecord | null>,
  ): Promise<CurrentConsentType[]> {
    const isOutdated = await Promise.all(
      CURRENT_CONSENT_TYPES.map(async (type) => {
        const consent = current[type];
        if (consent?.action !== 'granted') {
          return false;
        }
        const required = await this.legalDocuments.requiredVersion(type);
        return !isUpToDate(consent, required);
      }),
    );
    return CURRENT_CONSENT_TYPES.filter((_, index) => isOutdated[index]);
  }

  private async insertConsent(
    manager: EntityManager,
    input: InsertConsentInput,
  ): Promise<UserConsent> {
    const fingerprint = computeConsentFingerprint(input);
    const saved = await manager.save(
      manager.create(UserConsent, {
        userId: input.userId,
        vehicleId: input.vehicleId ?? null,
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
        vehicleId: saved.vehicleId,
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
    vehicleId: entity.vehicleId,
  };
}

type AcceptanceState = Pick<
  UserConsentRecord,
  'type' | 'action' | 'documentVersion' | 'recordedAt'
>;

// Concedida, no anterior a la versión del último cambio importante y, si es
// una declaración, aceptada hace menos de un año
function isUpToDate(
  consent: AcceptanceState | null,
  required: string,
  now = new Date(),
): boolean {
  return (
    consent?.action === 'granted' &&
    compareLegalVersions(consent.documentVersion, required) >= 0 &&
    !isExpired(consent, now)
  );
}

function isExpired(consent: AcceptanceState, now: Date): boolean {
  if (!DECLARATION_TYPES.has(consent.type)) {
    return false;
  }
  const validFrom = new Date(now);
  validFrom.setMonth(validFrom.getMonth() - DECLARATION_VALIDITY_MONTHS);
  return consent.recordedAt < validFrom;
}
