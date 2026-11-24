import { BusinessError } from '../../../shared/errors/business-error';

// Publicar varios días a la vez está apagado en los ajustes de la plataforma
// (lo enciende el administrador). La capa API lo traduce a un 409
// (MULTI_DAY_PUBLISHING_DISABLED)
export class MultiDayPublishingDisabledError extends BusinessError {
  constructor() {
    super(
      'MULTI_DAY_PUBLISHING_DISABLED',
      'conflict',
      'Publishing several days at once is turned off',
    );
  }
}
