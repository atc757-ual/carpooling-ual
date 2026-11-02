import { BusinessError } from '../../../shared/errors/business-error';

// No hay ninguna versión publicada de ese documento (404)
export class LegalDocumentNotFoundError extends BusinessError {
  constructor(readonly documentType: string) {
    super(
      'LEGAL_DOCUMENT_NOT_FOUND',
      'not_found',
      `There is no published version of the legal document (${documentType})`,
    );
  }
}
