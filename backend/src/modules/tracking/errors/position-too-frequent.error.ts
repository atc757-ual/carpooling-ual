import { BusinessError } from '../../../shared/errors/business-error';

// El conductor envía posiciones más a menudo de lo permitido
// (POSITION_MIN_INTERVAL_SECONDS). La capa API lo traduce a un 409
// (POSITION_TOO_FREQUENT): el móvil puede ignorarlo y enviar la siguiente
export class PositionTooFrequentError extends BusinessError {
  constructor(readonly minIntervalSeconds: number) {
    super(
      'POSITION_TOO_FREQUENT',
      'conflict',
      `Send at most one position every ${minIntervalSeconds} seconds`,
    );
  }
}
