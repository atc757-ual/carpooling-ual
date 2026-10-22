import { BusinessError } from '../../../shared/errors/business-error';

// El usuario no es un pasajero aceptado de ese viaje. La capa API lo traduce
// a un 403 (NOT_TRIP_PASSENGER)
export class NotTripPassengerError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'NOT_TRIP_PASSENGER',
      'forbidden',
      `You are not an accepted passenger of the trip ${tripId}`,
    );
  }
}
