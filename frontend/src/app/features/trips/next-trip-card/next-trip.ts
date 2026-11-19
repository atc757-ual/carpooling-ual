import { translate } from '@jsverse/transloco';
import { DriverTrip, Trip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';

// Viajes que aún no han terminado
const ACTIVE_TRIPS: ReadonlySet<TripStatus> = new Set(['published', 'confirmed', 'in_progress']);

// El próximo viaje del usuario, conduzca o viaje de pasajero
export type NextTrip =
  { role: 'driver'; trip: DriverTrip } | { role: 'passenger'; trip: Trip; request: SeatRequest };

// Plazas del pasajero que pueden ser su próximo viaje: pendientes o aceptadas
export function isOpenRequest({ status }: SeatRequest): boolean {
  return status === 'pending' || status === 'accepted';
}

// El que toca: primero el que está en curso; si no, el que sale antes
export function pickNextTrip(candidates: readonly NextTrip[]): NextTrip | null {
  const active = candidates.filter(({ trip }) => ACTIVE_TRIPS.has(trip.status));
  const sorted = [...active].sort(
    (left, right) =>
      Number(right.trip.status === 'in_progress') - Number(left.trip.status === 'in_progress') ||
      left.trip.departureAt.localeCompare(right.trip.departureAt),
  );
  return sorted[0] ?? null;
}

// Adónde lleva la tarjeta: con el viaje en curso, a «En curso»; si no, el
// conductor a su viaje y el pasajero a su plaza
export function nextTripLink(next: NextTrip): string {
  const isLive = next.trip.status === 'in_progress';
  if (next.role === 'driver') {
    return isLive ? `/tabs/trips/drive/${next.trip.id}` : `/tabs/trips/published/${next.trip.id}`;
  }
  return isLive && next.request.status === 'accepted'
    ? `/tabs/trips/ride/${next.request.id}`
    : `/tabs/trips/requests/${next.request.id}`;
}

// La etiqueta del estado: la del viaje para el conductor; para el pasajero,
// la de su plaza mientras está pendiente
export function nextTripStatus(next: NextTrip): {
  label: string;
  kind: 'pending' | 'accepted' | 'info';
} {
  if (next.role === 'passenger' && next.request.status === 'pending') {
    return { label: 'Pendiente', kind: 'pending' };
  }
  switch (next.trip.status) {
    case 'in_progress':
      return { label: translate('screens.nextTrip.curso'), kind: 'accepted' };
    case 'confirmed':
      return { label: next.role === 'driver' ? 'Confirmado' : 'Confirmada', kind: 'accepted' };
    default:
      return { label: 'Publicado', kind: 'info' };
  }
}
