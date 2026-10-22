import { BusinessError } from '../../../shared/errors/business-error';

// El pasajero ya tiene una solicitud viva (pendiente o aceptada) en ese viaje.
// La capa API lo traduce a un 409 (REQUEST_ALREADY_EXISTS)
export class RequestAlreadyExistsError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'REQUEST_ALREADY_EXISTS',
      'conflict',
      `You already have a pending or accepted request for the trip ${tripId}`,
    );
  }
}
