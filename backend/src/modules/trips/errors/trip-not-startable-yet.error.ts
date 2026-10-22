import { BusinessError } from '../../../shared/errors/business-error';

// RF-11: un viaje solo se puede iniciar desde poco antes de su hora de salida
// (START_WINDOW_MIN), para que nadie lo inicie por error días antes. La capa
// API lo traduce a un 409 (TRIP_NOT_STARTABLE_YET)
export class TripNotStartableYetError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly departureAt: Date,
    readonly windowMinutes: number,
  ) {
    super(
      'TRIP_NOT_STARTABLE_YET',
      'conflict',
      `The trip ${tripId} departs at ${departureAt.toISOString()}: it can be started from ${windowMinutes} minutes before`,
    );
  }
}
