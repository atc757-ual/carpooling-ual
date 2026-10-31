import { BusinessError } from '../../../shared/errors/business-error';

export class TripOverlapsError extends BusinessError {
  constructor(readonly tripId: string) {
    super('TRIP_OVERLAPS', 'conflict', `The trip overlaps with ${tripId}`);
  }
}
