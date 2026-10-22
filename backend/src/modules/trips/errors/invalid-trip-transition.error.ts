import { BusinessError } from '../../../shared/errors/business-error';
import type { TripStatus } from '../trip-status';

// Cambio de estado que el diagrama de estados del viaje no permite (RNF-10),
// p. ej. modificar un viaje ya cancelado. La capa API lo traduce a un 409
// (INVALID_TRIP_TRANSITION)
export class InvalidTripTransitionError extends BusinessError {
  constructor(
    readonly from: TripStatus,
    readonly to: TripStatus,
  ) {
    super(
      'INVALID_TRIP_TRANSITION',
      'conflict',
      `A trip cannot go from ${from} to ${to}`,
    );
  }
}
