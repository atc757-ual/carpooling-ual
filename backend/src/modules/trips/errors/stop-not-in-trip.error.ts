import { BusinessError } from '../../../shared/errors/business-error';

// La parada elegida no es de este viaje (o el viaje recoge en ruta y no tiene
// paradas). La capa API lo traduce a un 400 (STOP_NOT_IN_TRIP)
export class StopNotInTripError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly stopId: string | null,
  ) {
    super(
      'STOP_NOT_IN_TRIP',
      'invalid',
      `Stop ${stopId ?? '(none)'} is not a stop of trip ${tripId}`,
    );
  }
}
