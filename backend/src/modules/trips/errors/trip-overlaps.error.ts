import { BusinessError } from '../../../shared/errors/business-error';

// El viaje se cruza en el tiempo con otro viaje activo del mismo conductor
// (publicado, confirmado o en curso). La capa API lo traduce a un 409
// (TRIP_OVERLAPS)
export class TripOverlapsError extends BusinessError {
  constructor(readonly conflictingDepartureAt: Date) {
    super(
      'TRIP_OVERLAPS',
      'conflict',
      `The trip overlaps with another trip of the driver departing at ${conflictingDepartureAt.toISOString()}`,
    );
  }
}
