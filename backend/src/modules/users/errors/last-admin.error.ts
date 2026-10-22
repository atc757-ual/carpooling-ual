import { BusinessError } from '../../../shared/errors/business-error';

// No se puede retirar el último administrador activo: nadie podría volver a
// gestionar la plataforma. La capa API lo traduce a un 409 (LAST_ADMIN)
export class LastAdminError extends BusinessError {
  constructor() {
    super(
      'LAST_ADMIN',
      'conflict',
      'The last active administrator cannot be removed',
    );
  }
}
