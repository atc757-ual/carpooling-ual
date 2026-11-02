import { BusinessError } from '../../../shared/errors/business-error';

export class AlreadyBoardedError extends BusinessError {
  constructor(readonly requestId: string) {
    super(
      'ALREADY_BOARDED',
      'conflict',
      `La solicitud ${requestId} ya ha sido validada como subida al vehículo`,
    );
  }
}

