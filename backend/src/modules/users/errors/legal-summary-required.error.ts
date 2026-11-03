import { BusinessError } from '../../../shared/errors/business-error';

// Se publica un borrador sin «Qué ha cambiado» (422)
export class LegalSummaryRequiredError extends BusinessError {
  constructor(readonly documentType: string) {
    super(
      'LEGAL_SUMMARY_REQUIRED',
      'unprocessable',
      `The draft of the legal document (${documentType}) needs a summary of what changed before it is published`,
    );
  }
}
