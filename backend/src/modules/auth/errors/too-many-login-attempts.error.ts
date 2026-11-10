import { BusinessError } from '../../../shared/errors/business-error';

// Demasiados fallos seguidos con un correo: el login queda bloqueado unos
// minutos, aunque la contraseña sea correcta. Se responde igual exista o no el
// correo. La capa API lo traduce a un 429 (TOO_MANY_LOGIN_ATTEMPTS)
export class TooManyLoginAttemptsError extends BusinessError {
  constructor() {
    super(
      'TOO_MANY_LOGIN_ATTEMPTS',
      'too_many_requests',
      'Too many failed logins: try again in a few minutes',
    );
  }
}
