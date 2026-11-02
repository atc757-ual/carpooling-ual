import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import {
  LEGAL_DOCUMENT_TYPES,
  LegalDocument,
  LegalDocumentType,
} from './entities/legal-document.entity';
import { LegalDocumentNotFoundError } from './errors/legal-document-not-found.error';
import { LegalDraftNotFoundError } from './errors/legal-draft-not-found.error';
import { sanitizeLegalHtml } from './legal-html';

// «1.4» → «1.5»: cada versión publicada sube el número menor
export function nextLegalVersion(version: string): string {
  const [major, minor] = version.split('.').map(Number);
  return `${major}.${minor + 1}`;
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
  async currentVersions(): Promise<Record<LegalDocumentType, string>> {
    const [terms, privacy] = await Promise.all(
      LEGAL_DOCUMENT_TYPES.map((type) => this.getCurrent(type)),
    );
    return { terms: terms.version, privacy: privacy.version };
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

  // Crea o reemplaza el borrador (con la siguiente versión a la vigente)
  async saveDraft(
    type: LegalDocumentType,
    html: string,
  ): Promise<LegalDocument> {
    const content = sanitizeLegalHtml(html);
    return this.dataSource.transaction(async (manager) => {
      const draft = await manager.findOne(LegalDocument, {
        where: { type, status: 'draft' },
        lock: { mode: 'pessimistic_write' },
      });
      if (draft !== null) {
        draft.content = content;
        return manager.save(draft);
      }
      const current = await this.getCurrent(type);
      return manager.save(
        manager.create(LegalDocument, {
          type,
          version: nextLegalVersion(current.version),
          content,
          status: 'draft',
        }),
      );
    });
  }

  // Publica el borrador: pasa a ser la vigente y quien ya aceptó la anterior
  // tendrá que aceptarla al entrar
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
          publishedAt: published.publishedAt?.toISOString(),
          adminId,
        },
      });
      return published;
    });
  }
}
