import { BusinessError } from '../../../shared/errors/business-error';

export class AlreadyBoardedError extends BusinessError {
  constructor(readonly requestId: string) {
    super(
      'ALREADY_BOARDED',
      'conflict',
      `Seat request ${requestId} has already been boarded`,
    );
  }
}
