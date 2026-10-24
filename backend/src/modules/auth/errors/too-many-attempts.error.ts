import { BusinessError } from '../../../shared/errors/business-error';

// Se ha fallado el código el número máximo de veces: queda anulado y hay que
// pedir otro. La capa API lo traduce a un 429 (TOO_MANY_ATTEMPTS)
export class TooManyAttemptsError extends BusinessError {
  constructor() {
    super(
      'TOO_MANY_ATTEMPTS',
      'too_many_requests',
      'Too many wrong attempts: request a new code',
    );
  }
}
