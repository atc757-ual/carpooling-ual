import { BusinessError } from '../../../shared/errors/business-error';

// El conductor tiene 3 cancelaciones tardías en 30 días: no puede publicar
// hasta la fecha indicada. La capa API lo traduce a un 409
// (PUBLISHING_SUSPENDED)
export class PublishingSuspendedError extends BusinessError {
  constructor(readonly suspendedUntil: Date) {
    super(
      'PUBLISHING_SUSPENDED',
      'conflict',
      `Publishing is suspended until ${suspendedUntil.toISOString()} after repeated late cancellations`,
    );
  }
}
