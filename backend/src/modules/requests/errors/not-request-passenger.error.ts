import { BusinessError } from '../../../shared/errors/business-error';

// Solo el pasajero puede cancelar su solicitud (el conductor la rechaza o
// cancela el viaje). La capa API lo traduce a un 403 (NOT_REQUEST_PASSENGER)
export class NotRequestPassengerError extends BusinessError {
  constructor(readonly requestId: string) {
    super(
      'NOT_REQUEST_PASSENGER',
      'forbidden',
      `Only the passenger can cancel the seat request ${requestId}`,
    );
  }
}
