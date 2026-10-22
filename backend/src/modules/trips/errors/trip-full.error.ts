import { BusinessError } from '../../../shared/errors/business-error';

// No quedan plazas disponibles en el viaje. La capa API lo traduce a un 409
// (TRIP_FULL)
export class TripFullError extends BusinessError {
  constructor(readonly tripId: string) {
    super('TRIP_FULL', 'conflict', `The trip ${tripId} has no seats left`);
  }
}
