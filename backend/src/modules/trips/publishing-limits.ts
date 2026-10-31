import { TripOverlapsError } from './errors/trip-overlaps.error';

export const DAILY_TRIP_LIMIT = 4;

export interface TripInterval {
  id: string;
  departureAt: Date;
  durationMin: number;
  maxDetourMin: number;
}

export function assertNoOverlap(
  candidate: TripInterval,
  existing: readonly TripInterval[],
): void {
  const start = candidate.departureAt.getTime();
  const end = start + (candidate.durationMin + candidate.maxDetourMin) * 60_000;
  const conflict = existing.find((trip) => {
    const tripStart = trip.departureAt.getTime();
    const tripEnd = tripStart + (trip.durationMin + trip.maxDetourMin) * 60_000;
    return start < tripEnd && tripStart < end;
  });
  if (conflict) {
    throw new TripOverlapsError(conflict.id);
  }
}
