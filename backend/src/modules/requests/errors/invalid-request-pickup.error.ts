import { BusinessError } from '../../../shared/errors/business-error';

// Para pedir una plaza de ida al campus hacen falta el punto y su etiqueta.
export class InvalidRequestPickupError extends BusinessError {
  constructor() {
    super(
      'INVALID_REQUEST_PICKUP',
      'invalid',
      'A pickup location and name are required for a trip to campus',
    );
  }
}
