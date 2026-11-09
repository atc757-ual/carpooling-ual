import { BusinessError } from '../../../shared/errors/business-error';

export class InvalidBoardCodeError extends BusinessError {
  constructor() {
    super(
      'INVALID_BOARD_CODE',
      'invalid',
      'The 4-digit pickup code does not match the one of the passenger',
    );
  }
}
