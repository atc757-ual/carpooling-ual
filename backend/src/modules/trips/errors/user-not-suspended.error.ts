import { BusinessError } from '../../../shared/errors/business-error';
import type { LateCancellationRole } from '../entities/late-cancellation.entity';

// Se pide levantar una suspensión que no está en curso. La capa API lo
// traduce a un 409 (USER_NOT_SUSPENDED)
export class UserNotSuspendedError extends BusinessError {
  constructor(
    readonly userId: string,
    readonly role: LateCancellationRole,
  ) {
    super(
      'USER_NOT_SUSPENDED',
      'conflict',
      'The user ' + userId + ' is not suspended as ' + role,
    );
  }
}
