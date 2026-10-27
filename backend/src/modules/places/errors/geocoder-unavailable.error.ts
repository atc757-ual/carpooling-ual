import { BusinessError } from '../../../shared/errors/business-error';

// El servicio de direcciones (CartoCiudad) no responde a tiempo o falla. La
// capa API lo traduce a un 503 (GEOCODER_UNAVAILABLE): se puede reintentar
export class GeocoderUnavailableError extends BusinessError {
  constructor() {
    super(
      'GEOCODER_UNAVAILABLE',
      'unavailable',
      'The address service is not available right now',
    );
  }
}
