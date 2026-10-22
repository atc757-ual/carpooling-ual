import { BusinessError } from '../../../shared/errors/business-error';

// Un viaje solo se puede publicar o mover a una hora de salida futura. La
// capa API lo traduce a un 400 (DEPARTURE_IN_THE_PAST)
export class DepartureInThePastError extends BusinessError {
  constructor(readonly departureAt: Date) {
    super(
      'DEPARTURE_IN_THE_PAST',
      'invalid',
      `The departure time ${departureAt.toISOString()} is in the past`,
    );
  }
}
