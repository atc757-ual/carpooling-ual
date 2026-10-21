import { BusinessError } from '../../../shared/errors/business-error';

// El token de renovación no existe, ha caducado, está anulado o se ha
// reutilizado. Es el mismo error en todos los casos: el frontend hace lo mismo
// (volver al login) y un atacante no sabe qué ha fallado. 401
// (INVALID_REFRESH_TOKEN)
export class InvalidRefreshTokenError extends BusinessError {
  constructor() {
    super('INVALID_REFRESH_TOKEN', 'unauthorized', 'Invalid refresh token');
  }
}
