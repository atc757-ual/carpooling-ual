import { BusinessError } from '../../../shared/errors/business-error';

// El viaje recoge en puntos: el pasajero tiene que elegir una de sus paradas.
// La capa API lo traduce a un 400 (STOP_REQUIRED)
export class StopRequiredError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'STOP_REQUIRED',
      'invalid',
      `Trip ${tripId} picks up at its stops: choose one of them`,
    );
  }
}
