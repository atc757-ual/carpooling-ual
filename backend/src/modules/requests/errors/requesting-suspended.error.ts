import { BusinessError } from '../../../shared/errors/business-error';

// El pasajero tiene 3 cancelaciones tardías en 30 días: no puede pedir plaza
// hasta la fecha indicada (la misma regla que el conductor al publicar). La
// capa API lo traduce a un 409 (REQUESTING_SUSPENDED)
export class RequestingSuspendedError extends BusinessError {
  constructor(readonly suspendedUntil: Date) {
    super(
      'REQUESTING_SUSPENDED',
      'conflict',
      `Requesting seats is suspended until ${suspendedUntil.toISOString()} after repeated late cancellations`,
    );
  }
}
