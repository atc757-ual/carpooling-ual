import { BusinessError } from '../../../shared/errors/business-error';

// El enlace del viaje compartido no existe, se dejó de compartir, el pasajero
// ya no tiene la plaza o el viaje terminó hace más de 24 h. La capa API lo
// traduce a un 404 (SHARE_NOT_FOUND), sin decir cuál de los casos es
export class ShareNotFoundError extends BusinessError {
  constructor() {
    super('SHARE_NOT_FOUND', 'not_found', 'The shared trip link is not valid');
  }
}
