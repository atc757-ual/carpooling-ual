import type { Page, PageRequest } from '../../shared/pagination/page';
import { tabOrder } from '../../shared/pagination/trips-tab-query.dto';
import type { TripsTab } from '../../shared/pagination/trips-tab-query.dto';
import type { TripEntryKey } from '../trips/trip-lookup.service';

export type TripEntryRole = 'driver' | 'passenger';

// Una fila de «Tus viajes» sin cargar: un viaje que conduce o una solicitud
// suya de pasajero
export interface TripEntryRef extends TripEntryKey {
  role: TripEntryRole;
}

// Los dos papeles en una sola lista, ordenada por la salida (por venir, del
// más próximo; el resto, del más reciente) y el id para desempatar, y la
// página pedida con el total
export function pageTripEntries(
  keys: { driver: readonly TripEntryKey[]; passenger: readonly TripEntryKey[] },
  { tab, page }: { tab: TripsTab; page: PageRequest },
): Page<TripEntryRef> {
  const sign = tabOrder(tab) === 'ASC' ? 1 : -1;
  const entries: TripEntryRef[] = [
    ...keys.driver.map((key) => ({ ...key, role: 'driver' as const })),
    ...keys.passenger.map((key) => ({ ...key, role: 'passenger' as const })),
  ].sort(
    (left, right) =>
      sign *
      (left.departureAt.getTime() - right.departureAt.getTime() ||
        left.id.localeCompare(right.id)),
  );
  return {
    items: entries.slice(page.offset, page.offset + page.limit),
    total: entries.length,
  };
}
