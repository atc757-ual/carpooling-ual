import { BusinessError } from '../../../shared/errors/business-error';

// Error de negocio: describe QUÉ ha pasado, sin saber nada de HTTP. La capa API
// lo traduce a un 409 con el código EMAIL_ALREADY_REGISTERED (TMF630)
export class EmailAlreadyRegisteredError extends BusinessError {
  constructor(readonly email: string) {
    super(
      'EMAIL_ALREADY_REGISTERED',
      'conflict',
      `The email ${email} is already registered`,
    );
  }
}
