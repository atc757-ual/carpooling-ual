import { BusinessError } from '../../../shared/errors/business-error';

// No existe la solicitud, o el usuario no es ni su pasajero ni el conductor
// del viaje (es un dato privado: no se revela que existe). La capa API lo
// traduce a un 404 (REQUEST_NOT_FOUND)
export class RequestNotFoundError extends BusinessError {
  constructor(readonly requestId: string) {
    super(
      'REQUEST_NOT_FOUND',
      'not_found',
      `There is no seat request with id ${requestId}`,
    );
  }
}
