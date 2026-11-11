import { TripResult } from '../../core/models/trip-result.model';
import { TripSearch } from '../../core/models/trip-search.model';

// Cómo encaja un viaje con la búsqueda, para el color de su fila en los
// resultados (siempre con texto: el color solo no basta)
export type MatchFit = 'good' | 'fair' | 'tight';

export const MATCH_FIT_LABELS: Readonly<Record<MatchFit, string>> = {
  good: 'Encaja muy bien',
  fair: 'Encaja bien',
  tight: 'Encaja justo',
};

// Hasta 5 minutos de desvío se nota poco; desde 10, bastante
const SMALL_DETOUR_MIN = 5;
const LARGE_DETOUR_MIN = 10;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Bien: cerca de la hora pedida (un tercio del margen) y con poco desvío;
// justo: cerca del límite del margen o con mucho desvío; si no, medio. La
// hora que se compara es la de llegada al ir al campus y la de salida al volver
export function getMatchFit(
  trip: Pick<TripResult, 'arrivalTime' | 'departureTime' | 'pickupDetourMinutes'>,
  search: Pick<TripSearch, 'direction' | 'time' | 'margin'>,
): MatchFit {
  const tripTime = search.direction === 'to-campus' ? trip.arrivalTime : trip.departureTime;
  const offset = Math.abs(toMinutes(tripTime) - toMinutes(search.time));
  const share = search.margin > 0 ? offset / search.margin : 0;
  const detour = trip.pickupDetourMinutes;
  if (share > 2 / 3 || detour > LARGE_DETOUR_MIN) {
    return 'tight';
  }
  return share <= 1 / 3 && detour <= SMALL_DETOUR_MIN ? 'good' : 'fair';
}
