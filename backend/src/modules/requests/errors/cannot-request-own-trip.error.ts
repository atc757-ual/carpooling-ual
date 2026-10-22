import { BusinessError } from '../../../shared/errors/business-error';

// Un usuario con perfil de conductor y de pasajero no puede pedir plaza en su
// propio viaje. La capa API lo traduce a un 409 (CANNOT_REQUEST_OWN_TRIP)
export class CannotRequestOwnTripError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'CANNOT_REQUEST_OWN_TRIP',
      'conflict',
      `The trip ${tripId} is yours: you cannot request a seat in it`,
    );
  }
}
