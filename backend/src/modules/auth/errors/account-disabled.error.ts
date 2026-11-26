import { BusinessError } from '../../../shared/errors/business-error';

// Un administrador ha inhabilitado la cuenta (RF-25): no puede iniciar sesión
// hasta que la rehabilite. Solo se dice tras comprobar la contraseña, para no
// revelar qué correos existen. La capa API lo traduce a un 403
// (ACCOUNT_DISABLED)
export class AccountDisabledError extends BusinessError {
  constructor() {
    super(
      'ACCOUNT_DISABLED',
      'forbidden',
      'Your account has been disabled by an administrator',
    );
  }
}
