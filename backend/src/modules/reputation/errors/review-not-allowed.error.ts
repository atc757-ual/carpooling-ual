import { BusinessError } from '../../../shared/errors/business-error';

// Solo el conductor puede valorar a cada pasajero aceptado y cada pasajero
// aceptado al conductor cuando el viaje ha terminado (RF-22). La capa API lo
// traduce a un 403 (REVIEW_NOT_ALLOWED)
export class ReviewNotAllowedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'REVIEW_NOT_ALLOWED',
      'forbidden',
      `Review is not allowed for trip ${tripId}: the trip must be finished and the author and target must be the driver and an accepted passenger`,
    );
  }
}

