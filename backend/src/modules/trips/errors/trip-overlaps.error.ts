import { BusinessError } from '../../../shared/errors/business-error';

export class TripOverlapsError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly departureAt: Date,
  ) {
    super(
      'TRIP_OVERLAPS',
      'conflict',
      `The trip overlaps with ${tripId}, departing at ${departureAt.toISOString()}`,
    );
  }
}
