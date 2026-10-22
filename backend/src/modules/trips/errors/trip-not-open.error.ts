import { BusinessError } from '../../../shared/errors/business-error';
import type { TripStatus } from '../trip-status';

// El viaje ya no admite solicitudes: está en curso, finalizado o cancelado, o
// su hora de salida ya ha pasado. La capa API lo traduce a un 409
// (TRIP_NOT_OPEN)
export class TripNotOpenError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly status: TripStatus,
  ) {
    super(
      'TRIP_NOT_OPEN',
      'conflict',
      `The trip ${tripId} (${status}) no longer accepts seat requests`,
    );
  }
}
