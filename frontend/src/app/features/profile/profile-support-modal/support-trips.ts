import { dateTimeFormat } from '../../../core/i18n/app-locale';
import type { DriverTrip } from '../../../core/models/driver.model';
import type { TripEntryResponse } from '../../../core/models/my-trips.model';
import { TripsService } from '../../../core/services/trips/trips.service';

// Una opción de «¿Sobre qué viaje?»: el viaje y su texto
export interface SupportTripOption {
  id: string;
  label: string;
}

type SupportTrip = Pick<
  DriverTrip,
  'id' | 'code' | 'originName' | 'destinationName' | 'departureAt'
>;

// «VJ-0042 · Roquetas de Mar → Campus UAL · 20 nov» (sin nombres, sin ruta)
export function supportTripLabel(trip: SupportTrip): string {
  const route = [trip.originName, trip.destinationName].filter(Boolean).join(' → ');
  const day = dateTimeFormat({ day: 'numeric', month: 'short' }).format(new Date(trip.departureAt));
  return [trip.code, route, day].filter(Boolean).join(' · ');
}

// Los viajes recientes del usuario para elegir en soporte: la primera página
// de los próximos y la de los ya hechos (los que conduce y en los que pidió
// plaza), del que sale más tarde al que salió antes
export async function loadSupportTrips(trips: TripsService): Promise<SupportTripOption[]> {
  const pages = await Promise.all([
    trips.listMyTripEntries('upcoming', 0),
    trips.listMyTripEntries('past', 0),
  ]);
  const items = pages.flatMap((page) => page.items);
  const resolved = await Promise.all(items.map((item) => tripOf(trips, item)));
  const unique = new Map(resolved.map((trip) => [trip.id, trip]));
  return [...unique.values()]
    .sort((a, b) => b.departureAt.localeCompare(a.departureAt))
    .map((trip) => ({ id: trip.id, label: supportTripLabel(trip) }));
}

// El viaje de una fila: el que conduce o, de una solicitud, el que pidió
function tripOf(trips: TripsService, item: TripEntryResponse): Promise<SupportTrip> {
  return item.role === 'driver' ? Promise.resolve(item.trip) : trips.getTrip(item.request.trip.id);
}
