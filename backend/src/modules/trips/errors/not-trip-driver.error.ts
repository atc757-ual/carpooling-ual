import { BusinessError } from '../../../shared/errors/business-error';

// Solo el conductor del viaje puede modificarlo o cancelarlo. Los viajes son
// visibles para cualquier usuario autenticado, así que no se oculta que
// existe. La capa API lo traduce a un 403 (NOT_TRIP_DRIVER)
export class NotTripDriverError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'NOT_TRIP_DRIVER',
      'forbidden',
      `Only the driver of the trip ${tripId} can change it`,
    );
  }
}
