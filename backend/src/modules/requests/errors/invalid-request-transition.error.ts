import { BusinessError } from '../../../shared/errors/business-error';
import type { RequestStatus } from '../request-status';

// Cambio de estado que el diagrama de estados de la solicitud no permite
// (RNF-10), p. ej. aceptar una solicitud ya rechazada. La capa API lo
// traduce a un 409 (INVALID_REQUEST_TRANSITION)
export class InvalidRequestTransitionError extends BusinessError {
  constructor(
    readonly from: RequestStatus,
    readonly to: RequestStatus,
  ) {
    super(
      'INVALID_REQUEST_TRANSITION',
      'conflict',
      `A seat request cannot go from ${from} to ${to}`,
    );
  }
}
