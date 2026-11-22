import { BusinessError } from '../../../shared/errors/business-error';

// Solo se buscan otros viajes para una solicitud que se canceló porque el
// conductor canceló el suyo (no si la canceló el propio pasajero), y en los
// 30 min siguientes
export class RequestNotRelocatableError extends BusinessError {
  constructor(readonly requestId: string) {
    super(
      'REQUEST_NOT_RELOCATABLE',
      'conflict',
      `The request ${requestId} was not cancelled by its driver in the last 30 minutes`,
    );
  }
}
