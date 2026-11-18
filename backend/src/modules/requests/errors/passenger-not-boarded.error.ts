import { BusinessError } from '../../../shared/errors/business-error';

// La bajada solo se marca con el pasajero a bordo (validó su código de
// recogida): si no subió, el conductor lo marca como no presentado
export class PassengerNotBoardedError extends BusinessError {
  constructor(readonly requestId: string) {
    super(
      'PASSENGER_NOT_BOARDED',
      'conflict',
      `The passenger of seat request ${requestId} has not boarded yet`,
    );
  }
}
