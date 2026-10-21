import { BusinessError } from '../../../shared/errors/business-error';

// El token de acceso falta, está mal formado, su firma no es válida o su
// usuario ya no existe. La capa API lo traduce a un 401 (INVALID_ACCESS_TOKEN)
export class InvalidAccessTokenError extends BusinessError {
  constructor() {
    super('INVALID_ACCESS_TOKEN', 'unauthorized', 'Invalid access token');
  }
}
