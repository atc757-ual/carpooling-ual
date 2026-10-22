import { BusinessError } from '../../../shared/errors/business-error';

// RF-05: la cancelación ordinaria es antes del inicio. Cancelar un viaje en
// curso exige registrar una incidencia (RF-23). La capa API lo traduce a un
// 409 (TRIP_ALREADY_STARTED)
export class TripAlreadyStartedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'TRIP_ALREADY_STARTED',
      'conflict',
      `The trip ${tripId} has already started: cancelling it requires an incident`,
    );
  }
}
