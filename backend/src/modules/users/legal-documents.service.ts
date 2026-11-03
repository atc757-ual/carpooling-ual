import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import {
  LegalChangeType,
  LegalDocument,
  LegalDocumentType,
  SIGNUP_DOCUMENT_TYPES,
  SignupDocumentType,
} from './entities/legal-document.entity';
import { User } from './entities/user.entity';
import { LegalDocumentNotFoundError } from './errors/legal-document-not-found.error';
import { LegalDraftNotFoundError } from './errors/legal-draft-not-found.error';
import { LegalSummaryRequiredError } from './errors/legal-summary-required.error';
import { sanitizeLegalHtml } from './legal-html';

// La versión del borrador: un cambio importante sube la mayor («1.4» → «2.0»)
// y uno menor, la menor («1.4» → «1.5»)
export function nextLegalVersion(
  version: string,
  changeType: LegalChangeType,
): string {
  const [major, minor] = version.split('.').map(Number);
  return changeType === 'major' ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

// «1.10» va después de «1.9»: se comparan los números, no el texto
export function compareLegalVersions(a: string, b: string): number {
  const [aMajor, aMinor] = a.split('.').map(Number);
  const [bMajor, bMinor] = b.split('.').map(Number);
  return aMajor - bMajor || aMinor - bMinor;
}

export interface LegalDraftChanges {
  content: string;
  changeType: LegalChangeType;
  summary: string | null;
}

// Documentos legales con versiones: la vigente de cada uno (la publicada más
// reciente) y, en el panel, su historial y un borrador que se edita y se
// publica. El contenido se guarda ya saneado
@Injectable()
export class LegalDocumentsService {
  constructor(
    @InjectRepository(LegalDocument)
    private readonly documentsRepository: Repository<LegalDocument>,
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
    private readonly notifications: NotificationsService,
  ) {}

  // La versión vigente; LegalDocumentNotFoundError si no hay ninguna
  async getCurrent(type: LegalDocumentType): Promise<LegalDocument> {
    const document = await this.documentsRepository.findOne({
      where: { type, status: 'published' },
      order: { publishedAt: 'DESC' },
    });
    if (document === null) {
      throw new LegalDocumentNotFoundError(type);
    }
    return document;
  }

  // La versión vigente de cada documento (para registrar los consentimientos)
  async currentDocuments(): Promise<Record<SignupDocumentType, LegalDocument>> {
    const [terms, privacy] = await Promise.all(
      SIGNUP_DOCUMENT_TYPES.map((type) => this.getCurrent(type)),
    );
    return { terms, privacy };
  }

  // La versión que hay que haber aceptado para usar la app: la última que
  // cambió de forma importante (los cambios menores solo se avisan)
  async requiredVersion(type: LegalDocumentType): Promise<string> {
    const document = await this.documentsRepository.findOne({
      where: { type, status: 'published', changeType: 'major' },
      order: { publishedAt: 'DESC' },
    });
    if (document === null) {
      throw new LegalDocumentNotFoundError(type);
    }
    return document.version;
  }

  // Todas las versiones, con los borradores, la más reciente primero (panel)
  async list(
    filter: { type?: LegalDocumentType },
    page: PageRequest,
  ): Promise<Page<LegalDocument>> {
    const [items, total] = await this.documentsRepository.findAndCount({
      where: filter.type === undefined ? {} : { type: filter.type },
      order: { type: 'ASC', createdAt: 'DESC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  // El borrador; LegalDraftNotFoundError si no hay
  async getDraft(type: LegalDocumentType): Promise<LegalDocument> {
    const draft = await this.documentsRepository.findOneBy({
      type,
      status: 'draft',
    });
    if (draft === null) {
      throw new LegalDraftNotFoundError(type);
    }
    return draft;
  }

  // Crea o reemplaza el borrador. Su versión sale de la vigente y del tipo de
  // cambio, así que cambia si se cambia el tipo
  async saveDraft(
    type: LegalDocumentType,
    changes: LegalDraftChanges,
  ): Promise<LegalDocument> {
    const content = sanitizeLegalHtml(changes.content);
    const trimmed = changes.summary?.trim() ?? '';
    const summary = trimmed === '' ? null : trimmed;
    return this.dataSource.transaction(async (manager) => {
      const current = await this.getCurrent(type);
      const version = nextLegalVersion(current.version, changes.changeType);
      const draft = await manager.findOne(LegalDocument, {
        where: { type, status: 'draft' },
        lock: { mode: 'pessimistic_write' },
      });
      return manager.save(
        Object.assign(
          draft ?? manager.create(LegalDocument, { type, status: 'draft' }),
          { content, version, changeType: changes.changeType, summary },
        ),
      );
    });
  }

  // Publica el borrador (con su «Qué ha cambiado»): pasa a ser la vigente. Si
  // el cambio es importante, cada usuario tendrá que aceptarla al entrar
  async publish(
    adminId: string,
    type: LegalDocumentType,
  ): Promise<LegalDocument> {
    return this.dataSource.transaction(async (manager) => {
      const draft = await manager.findOne(LegalDocument, {
        where: { type, status: 'draft' },
        lock: { mode: 'pessimistic_write' },
      });
      if (draft === null) {
        throw new LegalDraftNotFoundError(type);
      }
      if (draft.summary === null) {
        throw new LegalSummaryRequiredError(type);
      }
      draft.status = 'published';
      draft.publishedAt = new Date();
      draft.publishedBy = adminId;
      const published = await manager.save(draft);
      await this.events.record(manager, {
        type: 'legal_document.published',
        sourceEntityId: published.id,
        payload: {
          type: published.type,
          version: published.version,
          changeType: published.changeType,
          summary: published.summary,
          publishedAt: published.publishedAt?.toISOString(),
          adminId,
        },
      });
      // Solo las condiciones y la política se avisan a todos; la declaración
      // del conductor se pide en su flujo (al publicar un viaje)
      if (
        published.changeType === 'minor' &&
        published.type !== 'driver_declaration'
      ) {
        await this.notifyMinorChange(manager, published);
      }
      return published;
    });
  }

  // Tras un cambio menor no se pide aceptar nada: se avisa en Avisos a cada
  // usuario activo (el aviso queda como registro de que se le informó)
  private async notifyMinorChange(
    manager: EntityManager,
    published: LegalDocument,
  ): Promise<void> {
    // FOR SHARE: si a la vez se borra un usuario, espera a que se publique
    // (si no, su aviso apuntaría a un usuario que ya no existe)
    const users = await manager.find(User, {
      select: { id: true },
      where: { deactivatedAt: IsNull() },
      lock: { mode: 'pessimistic_read' },
    });
    await this.notifications.notify(
      manager,
      users.map(({ id }) => id),
      {
        type: published.type === 'terms' ? 'terms_updated' : 'privacy_updated',
        legalDocumentId: published.id,
      },
    );
  }
}
