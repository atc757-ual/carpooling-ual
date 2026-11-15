import { BusinessError } from '../../../shared/errors/business-error';

// No hay ninguna pregunta con ese id (para la app, tampoco si es un
// borrador). La capa API lo traduce a un 404 (FAQ_NOT_FOUND)
export class FaqNotFoundError extends BusinessError {
  constructor(readonly faqId: string) {
    super('FAQ_NOT_FOUND', 'not_found', `There is no FAQ ${faqId}`);
  }
}
