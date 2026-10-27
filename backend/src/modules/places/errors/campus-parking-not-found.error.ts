import { BusinessError } from '../../../shared/errors/business-error';

// No existe un parking activo con ese id. La capa API lo traduce a un 404
// (CAMPUS_PARKING_NOT_FOUND)
export class CampusParkingNotFoundError extends BusinessError {
  constructor(readonly parkingId: string) {
    super(
      'CAMPUS_PARKING_NOT_FOUND',
      'not_found',
      `There is no campus parking with id ${parkingId}`,
    );
  }
}
