import { BusinessError } from '../../../shared/errors/business-error';

// El conductor ya tiene el máximo de viajes no cancelados ese día (hora de
// Madrid). La capa API lo traduce a un 409 (DAILY_TRIP_LIMIT)
export class DailyTripLimitError extends BusinessError {
  constructor(readonly tripLimit: number) {
    super(
      'DAILY_TRIP_LIMIT',
      'conflict',
      `A driver cannot have more than ${tripLimit} trips on the same day`,
    );
  }
}
