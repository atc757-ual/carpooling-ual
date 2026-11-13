import { BusinessError } from '../../../shared/errors/business-error';

// Otra plaza se aceptó o se soltó mientras se calculaba la ruta con las
// recogidas: hay que volver a intentarlo. El mismo código que TripChangedError
// de las solicitudes (409 TRIP_CHANGED_RETRY)
export class TripPickupsChangedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'TRIP_CHANGED_RETRY',
      'conflict',
      `The pickups of trip ${tripId} changed while planning its route; retry`,
    );
  }
}
