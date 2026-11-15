import { BusinessError } from '../../../shared/errors/business-error';

// No hay ninguna pregunta publicada con ese id (un borrador tampoco se ve).
// La capa API lo traduce a un 404 (FAQ_NOT_FOUND)
export class FaqNotFoundError extends BusinessError {
  constructor(readonly faqId: string) {
    super('FAQ_NOT_FOUND', 'not_found', `There is no published FAQ ${faqId}`);
  }
}
