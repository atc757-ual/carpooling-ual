import { BusinessError } from '../../../shared/errors/business-error';

// La ruta o la salida cambiaron mientras se calculaba la hora de recogida.
export class TripChangedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'TRIP_CHANGED_RETRY',
      'conflict',
      `The trip ${tripId} changed while preparing the pickup time; retry the request`,
    );
  }
}
