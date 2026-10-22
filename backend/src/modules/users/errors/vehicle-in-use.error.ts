import { BusinessError } from '../../../shared/errors/business-error';

// El vehículo está en un viaje en curso y no se puede dar de baja ahora.
// La capa API lo traduce a un 409 (VEHICLE_IN_USE)
export class VehicleInUseError extends BusinessError {
  constructor(readonly vehicleId: string) {
    super(
      'VEHICLE_IN_USE',
      'conflict',
      `The vehicle ${vehicleId} is on a trip and cannot be deactivated`,
    );
  }
}
