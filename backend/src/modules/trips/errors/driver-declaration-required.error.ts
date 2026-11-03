import { BusinessError } from '../../../shared/errors/business-error';

// RF-21: al iniciar un viaje, la declaración del conductor no está al día: se
// aceptó hace más de un año o cambió de forma importante después. Se acepta
// con PUT /api/users/me/driver-declaration (409)
export class DriverDeclarationRequiredError extends BusinessError {
  constructor(readonly driverId: string) {
    super(
      'DRIVER_DECLARATION_REQUIRED',
      'conflict',
      'The driver needs to accept the responsible declaration again before starting the trip',
    );
  }
}
