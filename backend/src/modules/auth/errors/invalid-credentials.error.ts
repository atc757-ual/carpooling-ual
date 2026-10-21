import { BusinessError } from '../../../shared/errors/business-error';

// Error de negocio: correo o contraseña incorrectos. Es el MISMO error en los
// dos casos a propósito, para que nadie pueda averiguar qué correos están
// registrados. La capa API lo traduce a un 401 (INVALID_CREDENTIALS)
export class InvalidCredentialsError extends BusinessError {
  constructor() {
    super('INVALID_CREDENTIALS', 'unauthorized', 'Invalid email or password');
  }
}
