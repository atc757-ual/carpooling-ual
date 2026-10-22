import { BusinessError } from '../../../shared/errors/business-error';
import type { TripStatus } from '../trip-status';

// Un viaje solo se puede modificar mientras está publicado (sin pasajeros
// aceptados); confirmado solo se puede cancelar (RF-05). La capa API lo
// traduce a un 409 (TRIP_NOT_EDITABLE)
export class TripNotEditableError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly status: TripStatus,
  ) {
    super(
      'TRIP_NOT_EDITABLE',
      'conflict',
      `The trip ${tripId} is ${status}: only published trips can be changed`,
    );
  }
}
