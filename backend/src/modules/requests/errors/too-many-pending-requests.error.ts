import { BusinessError } from '../../../shared/errors/business-error';

export class TooManyPendingRequestsError extends BusinessError {
  constructor() {
    super(
      'TOO_MANY_PENDING_REQUESTS',
      'conflict',
      'The passenger already has three pending requests for overlapping trips',
    );
  }
}
