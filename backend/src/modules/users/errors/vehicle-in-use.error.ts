import { BusinessError } from '../../../shared/errors/business-error';

// El vehículo está en un viaje en curso: no se puede dar de baja ni usar en
// otro viaje hasta que termine. La capa API lo traduce a un 409
// (VEHICLE_IN_USE)
export class VehicleInUseError extends BusinessError {
  constructor(readonly vehicleId: string) {
    super(
      'VEHICLE_IN_USE',
      'conflict',
      `The vehicle ${vehicleId} is already on a trip in progress`,
    );
  }
}
