import { DriverTrip, Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { driverTripTab, passengerTripTab, TripsTab } from './trip-tabs';

// Una solicitud del pasajero con su viaje
export interface PassengerTrip {
  request: SeatRequest;
  trip: Trip;
}

// Un viaje de Tus viajes, conduzca o viaje de pasajero: una sola lista con
// los dos papeles, cada uno con su tarjeta
export type TripEntry =
  | { role: 'driver'; id: string; departureAt: string; trip: DriverTrip; pendingCount: number }
  | { role: 'passenger'; id: string; departureAt: string; item: PassengerTrip };

export interface TripDayGroup {
  // Único aunque el mismo día salga en dos grupos
  id: string;
  day: string;
  entries: TripEntry[];
}

export function driverEntry(trip: DriverTrip, pendingCount = 0): TripEntry {
  return {
    role: 'driver',
    id: `driver-${trip.id}`,
    departureAt: trip.departureAt,
    trip,
    pendingCount,
  };
}

export function passengerEntry(item: PassengerTrip): TripEntry {
  return {
    role: 'passenger',
    id: `passenger-${item.request.id}`,
    departureAt: item.trip.departureAt,
    item,
  };
}

export function entryTab(entry: TripEntry): TripsTab {
  return entry.role === 'driver'
    ? driverTripTab(entry.trip)
    : passengerTripTab(entry.item.request, entry.item.trip);
}

// El día de la salida en la hora local (AAAA-MM-DD)
function dayKey({ departureAt }: TripEntry): string {
  return new Date(departureAt).toLocaleDateString('sv-SE');
}

function hasPending(entry: TripEntry): number {
  return entry.role === 'driver' && entry.pendingCount > 0 ? 1 : 0;
}

// Los del filtro: los próximos, del primero que sale al último (y en cada
// día, antes los viajes con solicitudes por responder); los demás, del más
// reciente al más antiguo
export function tabEntries(entries: readonly TripEntry[], tab: TripsTab): TripEntry[] {
  const inTab = entries.filter((entry) => entryTab(entry) === tab);
  if (tab !== 'upcoming') {
    return inTab.sort((left, right) => right.departureAt.localeCompare(left.departureAt));
  }
  return inTab.sort(
    (left, right) =>
      dayKey(left).localeCompare(dayKey(right)) ||
      hasPending(right) - hasPending(left) ||
      left.departureAt.localeCompare(right.departureAt),
  );
}

// Agrupados por día, en el orden que ya traen: un grupo nuevo cada vez que
// cambia el día
export function groupByDay(entries: readonly TripEntry[]): TripDayGroup[] {
  const groups: { key: string; entries: TripEntry[] }[] = [];
  for (const entry of entries) {
    const key = dayKey(entry);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, entries: [entry] });
    }
  }
  return groups.map(({ key, entries: dayEntries }, index) => ({
    id: `${index}-${key}`,
    day: formatDateLabel(key),
    entries: dayEntries,
  }));
}
