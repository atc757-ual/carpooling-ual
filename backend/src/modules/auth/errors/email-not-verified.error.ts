import { BusinessError } from '../../../shared/errors/business-error';

// Contraseña correcta, pero el correo aún no está verificado: la app lleva al
// usuario a la pantalla del código. Solo se lanza tras comprobar la
// contraseña, así no revela qué correos están registrados. La capa API lo
// traduce a un 403 (EMAIL_NOT_VERIFIED)
export class EmailNotVerifiedError extends BusinessError {
  constructor() {
    super(
      'EMAIL_NOT_VERIFIED',
      'forbidden',
      'The email has not been verified yet',
    );
  }
}
