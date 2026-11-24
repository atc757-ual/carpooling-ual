import { BusinessError } from '../../../shared/errors/business-error';

// El vehículo tiene viajes publicados o confirmados por delante: darlo de baja
// los dejaría sin poder iniciarse. Antes hay que pasarlos a otro coche o
// cancelarlos. La capa API lo traduce a un 409 (VEHICLE_HAS_UPCOMING_TRIPS)
export class VehicleHasUpcomingTripsError extends BusinessError {
  constructor(
    readonly vehicleId: string,
    readonly tripCount: number,
  ) {
    super(
      'VEHICLE_HAS_UPCOMING_TRIPS',
      'conflict',
      `The vehicle ${vehicleId} has ${tripCount} upcoming trips: move them to another vehicle or cancel them first`,
    );
  }
}
