import { BusinessError } from '../../../shared/errors/business-error';
import type { TripStatus } from '../../trips/trip-status';

// El viaje solo se comparte desde que hay plaza aceptada (confirmado) hasta
// que termina (en curso). La capa API lo traduce a un 409 (SHARE_NOT_ALLOWED)
export class ShareNotAllowedError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly status: TripStatus,
  ) {
    super(
      'SHARE_NOT_ALLOWED',
      'conflict',
      `The trip ${tripId} is ${status}: it can only be shared while confirmed or in progress`,
    );
  }
}
