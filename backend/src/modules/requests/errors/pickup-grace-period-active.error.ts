import { BusinessError } from '../../../shared/errors/business-error';

export class PickupGracePeriodActiveError extends BusinessError {
  constructor(readonly minutesLeft: number) {
    super(
      'PICKUP_GRACE_PERIOD_ACTIVE',
      'invalid',
      `Wait at least 5 minutes after the pickup time before marking a no-show (${minutesLeft} min left)`,
    );
  }
}
