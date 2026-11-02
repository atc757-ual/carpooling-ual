import { BusinessError } from '../../../shared/errors/business-error';

export class InvalidBoardCodeError extends BusinessError {
  constructor() {
    super(
      'INVALID_BOARD_CODE',
      'invalid',
      'El código de recogida de 4 cifras no coincide con el del pasajero',
    );
  }
}
