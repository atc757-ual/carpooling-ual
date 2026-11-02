import { BusinessError } from '../../../shared/errors/business-error';

// El punto de un parking queda fuera de la zona de servicio: no se podría
// llegar a él desde la app. La capa API lo traduce a un 400
// (PARKING_OUTSIDE_SERVICE_AREA)
export class ParkingOutsideServiceAreaError extends BusinessError {
  constructor() {
    super(
      'PARKING_OUTSIDE_SERVICE_AREA',
      'invalid',
      'The parking is outside the service area',
    );
  }
}
