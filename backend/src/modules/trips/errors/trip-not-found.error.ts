import { BusinessError } from '../../../shared/errors/business-error';

// No existe ningún viaje con ese id. La capa API lo traduce a un 404
// (TRIP_NOT_FOUND)
export class TripNotFoundError extends BusinessError {
  constructor(readonly tripId: string) {
    super('TRIP_NOT_FOUND', 'not_found', `There is no trip with id ${tripId}`);
  }
}
