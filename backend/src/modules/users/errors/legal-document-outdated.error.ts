import { BusinessError } from '../../../shared/errors/business-error';

// La versión aceptada no es la vigente
export class LegalDocumentOutdatedError extends BusinessError {
  constructor(readonly documentType: string) {
    super(
      'LEGAL_DOCUMENT_OUTDATED',
      'conflict',
      ` hay que leer la última (409):The accepted version is not the current one (${documentType})`,
    );
  }
}
