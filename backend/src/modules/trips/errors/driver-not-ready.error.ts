import { BusinessError } from '../../../shared/errors/business-error';
import type { DriverReadiness } from '../../users/driver-readiness';

// RF-21: antes de publicar su primer viaje, el conductor debe aceptar la
// declaración responsable y registrar al menos un vehículo. El mensaje indica
// qué le falta. La capa API lo traduce a un 403 (DRIVER_NOT_READY)
export class DriverNotReadyError extends BusinessError {
  constructor(readonly readiness: DriverReadiness) {
    const missing = [
      ...(readiness.hasLicenseDeclared ? [] : ['the responsible declaration']),
      ...(readiness.activeVehicles > 0 ? [] : ['an active vehicle']),
    ];
    super(
      'DRIVER_NOT_READY',
      'forbidden',
      `To publish trips the driver needs: ${missing.join(' and ')}`,
    );
  }
}
