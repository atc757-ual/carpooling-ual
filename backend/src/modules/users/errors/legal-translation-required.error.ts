import { BusinessError } from '../../../shared/errors/business-error';

// Se publica un borrador sin su texto o su «Qué ha cambiado» en inglés (422)
export class LegalTranslationRequiredError extends BusinessError {
  constructor(readonly documentType: string) {
    super(
      'LEGAL_TRANSLATION_REQUIRED',
      'unprocessable',
      `The draft of the legal document (${documentType}) needs its English text and summary before it is published`,
    );
  }
}
