import { BusinessError } from '../../../shared/errors/business-error';

// La matrícula ya está registrada (por otro conductor, o activa por el mismo).
// La capa API lo traduce a un 409 (VEHICLE_ALREADY_REGISTERED)
export class VehicleAlreadyRegisteredError extends BusinessError {
  constructor(readonly plate: string) {
    super(
      'VEHICLE_ALREADY_REGISTERED',
      'conflict',
      `The vehicle ${plate} is already registered`,
    );
  }
}
