import { CampusEntranceId, TripDirection, TripSearch } from '../../core/models/trip-search.model';
import { CAMPUS_ENTRANCES } from './campus-entrances';

export const PLACE_MAX_LENGTH = 120;
// Margen sobre la hora, en minutos
export const MARGINS = [10, 20, 30] as const;
// Plazas que se buscan (un coche lleva como mucho 4 pasajeros)
export const MIN_SEATS = 1;
export const MAX_SEATS = 4;

const DIRECTIONS: ReadonlySet<unknown> = new Set<TripDirection>(['to-campus', 'from-campus']);
const MARGIN_VALUES: ReadonlySet<unknown> = new Set(MARGINS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// Fecha real del calendario (descarta 2026-02-30)
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

function isEntrance(value: unknown): value is CampusEntranceId {
  return CAMPUS_ENTRANCES.some((entrance) => entrance.id === value);
}

function isDirection(value: unknown): value is TripDirection {
  return DIRECTIONS.has(value);
}

function isSeats(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= MIN_SEATS && Number(value) <= MAX_SEATS;
}

// Una búsqueda guardada (sessionStorage), o null si falta algo o algún valor
// no vale (guardada por una versión anterior o tocada a mano): Buscar se
// muestra entonces como si no se hubiera buscado nada
export function parseTripSearch(value: unknown): TripSearch | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const { place, entrance, direction, date, time, margin, seats } = value as Record<
    string,
    unknown
  >;
  const trimmedPlace = typeof place === 'string' ? place.trim() : '';
  const isValid =
    trimmedPlace.length > 0 &&
    trimmedPlace.length <= PLACE_MAX_LENGTH &&
    isEntrance(entrance) &&
    isDirection(direction) &&
    isCalendarDate(date) &&
    isTime(time) &&
    MARGIN_VALUES.has(margin) &&
    isSeats(seats);
  return isValid
    ? { place: trimmedPlace, entrance, direction, date, time, margin: Number(margin), seats }
    : null;
}
