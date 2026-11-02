import { BusinessError } from '../../../shared/errors/business-error';

// El color no está en el catálogo o está desactivado: no se puede elegir. La
// capa API lo traduce a un 400 (VEHICLE_COLOR_NOT_OFFERED)
export class VehicleColorNotOfferedError extends BusinessError {
  constructor(readonly color: string) {
    super(
      'VEHICLE_COLOR_NOT_OFFERED',
      'invalid',
      `The vehicle color ${color} is not offered`,
    );
  }
}
