import { BusinessError } from '../../../shared/errors/business-error';

// RF-21: el vehículo no tiene al día su declaración (seguro e ITV): nunca se
// aceptó o cambió de forma importante después. Se acepta con
// PUT /api/vehicles/{id}/declaration (409)
export class VehicleDeclarationRequiredError extends BusinessError {
  constructor(readonly vehicleId: string) {
    super(
      'VEHICLE_DECLARATION_REQUIRED',
      'conflict',
      `The vehicle ${vehicleId} needs its declaration (insurance and ITV) accepted before publishing trips with it`,
    );
  }
}
