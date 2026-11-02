import { BusinessError } from '../../../shared/errors/business-error';

export class PickupGracePeriodActiveError extends BusinessError {
  constructor(readonly minutesLeft: number) {
    super(
      'PICKUP_GRACE_PERIOD_ACTIVE',
      'invalid',
      `Debes esperar al menos 5 minutos tras la hora de recogida antes de marcar «No se presentó» (quedan ${minutesLeft} min)`,
    );
  }
}

