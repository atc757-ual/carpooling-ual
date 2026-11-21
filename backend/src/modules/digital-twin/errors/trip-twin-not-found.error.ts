import { BusinessError } from '../../../shared/errors/business-error';

// El gemelo vivo no conoce ese viaje: no existe o aún no le ha llegado su
// evento. La capa API lo traduce a un 404 (TRIP_TWIN_NOT_FOUND)
export class TripTwinNotFoundError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'TRIP_TWIN_NOT_FOUND',
      'not_found',
      `The digital twin has no trip with id ${tripId}`,
    );
  }
}
