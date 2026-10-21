import { BusinessError } from '../../../shared/errors/business-error';

// El token de acceso era válido pero ha caducado (15 min). Tiene su propio
// código para que el frontend sepa que debe renovarlo con el refresh token
// (PR B) en vez de mandar al usuario al login. 401 (ACCESS_TOKEN_EXPIRED)
export class AccessTokenExpiredError extends BusinessError {
  constructor() {
    super('ACCESS_TOKEN_EXPIRED', 'unauthorized', 'Access token expired');
  }
}
