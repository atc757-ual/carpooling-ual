import { MINUTE_MS } from './trip-timing';

// Un viaje en el calendario del conductor: ocupa desde la salida hasta la
// llegada más el desvío máximo que acepta (lo que puede tardar como mucho)
export interface ScheduledTrip {
  departureAt: Date;
  durationMin: number;
  maxDetourMin: number;
}

function endOf(trip: ScheduledTrip): number {
  return (
    trip.departureAt.getTime() +
    (trip.durationMin + trip.maxDetourMin) * MINUTE_MS
  );
}

// El primer viaje que se cruza con el candidato, o undefined. Dos viajes
// seguidos (uno llega justo cuando sale el otro) no se cruzan
export function findOverlap<T extends ScheduledTrip>(
  candidate: ScheduledTrip,
  scheduled: readonly T[],
): T | undefined {
  const start = candidate.departureAt.getTime();
  const end = endOf(candidate);
  return scheduled.find(
    (trip) => start < endOf(trip) && trip.departureAt.getTime() < end,
  );
}
