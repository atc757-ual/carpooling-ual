import { TripOverlapsError } from './errors/trip-overlaps.error';
import { MAX_TRIPS_PER_DAY } from './trip-timing';

export interface TripInterval {
  id: string;
  departureAt: Date;
  durationMin: number;
  maxDetourMin: number;
  status: 'published' | 'confirmed' | 'in_progress' | 'finished' | 'cancelled';
}

export function assertNoOverlap(
  candidate: TripInterval,
  existing: readonly TripInterval[],
): void {
  const start = candidate.departureAt.getTime();
  const end = start + (candidate.durationMin + candidate.maxDetourMin) * 60_000;
  const conflict = existing.find((trip) => {
    if (
      trip.status === 'finished' ||
      trip.status === 'cancelled' ||
      trip.id === candidate.id
    ) {
      return false;
    }
    const tripStart = trip.departureAt.getTime();
    const tripEnd = tripStart + (trip.durationMin + trip.maxDetourMin) * 60_000;
    return start < tripEnd && tripStart < end;
  });
  if (conflict) {
    throw new TripOverlapsError(conflict.id, conflict.departureAt);
  }
}

export { MAX_TRIPS_PER_DAY };
