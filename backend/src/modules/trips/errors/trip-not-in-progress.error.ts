import { BusinessError } from '../../../shared/errors/business-error';
import type { TripStatus } from '../trip-status';

// Acción que solo tiene sentido durante el viaje (p. ej. cancelarlo con una
// incidencia, RF-23) sobre un viaje que no está en curso. La capa API lo
// traduce a un 409 (TRIP_NOT_IN_PROGRESS)
export class TripNotInProgressError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly status: TripStatus,
  ) {
    super(
      'TRIP_NOT_IN_PROGRESS',
      'conflict',
      `The trip ${tripId} is ${status}, not in progress`,
    );
  }
}
