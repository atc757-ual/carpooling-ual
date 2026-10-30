import { BusinessError } from '../../../shared/errors/business-error';

// La salida está demasiado cerca: un viaje se publica (o se mueve) con al
// menos una hora de antelación, para que quede margen de cancelar sin
// penalización. La capa API lo traduce a un 400 (DEPARTURE_TOO_SOON)
export class DepartureTooSoonError extends BusinessError {
  constructor(
    readonly departureAt: Date,
    readonly minLeadMin: number,
  ) {
    super(
      'DEPARTURE_TOO_SOON',
      'invalid',
      `The departure time ${departureAt.toISOString()} must be at least ${minLeadMin} minutes from now`,
    );
  }
}
