import { BusinessError } from '../../../shared/errors/business-error';

// No hay ningún borrador de ese documento que publicar (404)
export class LegalDraftNotFoundError extends BusinessError {
  constructor(readonly documentType: string) {
    super(
      'LEGAL_DRAFT_NOT_FOUND',
      'not_found',
      `There is no draft of the legal document (${documentType})`,
    );
  }
}
