import { BusinessError } from '../../../shared/errors/business-error';

export class DailyTripLimitError extends BusinessError {
  constructor(readonly tripLimit: number) {
    super(
      'DAILY_TRIP_LIMIT',
      'conflict',
      `A driver cannot publish more than ${tripLimit} trips in one day`,
    );
  }
}
