import { Params } from '@angular/router';
import { CampusEntranceId, TripDirection, TripSearch } from '../../core/models/trip-search.model';
import { CAMPUS_ENTRANCES } from './campus-entrances';

export const PLACE_MAX_LENGTH = 120;
// Margen sobre la hora, en minutos
export const MARGINS = [10, 20, 30] as const;
// Plazas que se buscan (un coche lleva como mucho 4 pasajeros)
export const MIN_SEATS = 1;
export const MAX_SEATS = 4;

const DIRECTIONS: ReadonlySet<unknown> = new Set<TripDirection>(['to-campus', 'from-campus']);
const MARGIN_VALUES: ReadonlySet<number> = new Set(MARGINS);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

// La búsqueda, en los parámetros de la URL de Buscar (?place=…&entrance=north…)
export function toSearchParams(search: TripSearch): Params {
  return { ...search, place: search.place.trim() };
}

// Fecha real del calendario (descarta 2026-02-30)
function isCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseInteger(value: unknown): number | null {
  return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : null;
}

function isEntrance(value: unknown): value is CampusEntranceId {
  return CAMPUS_ENTRANCES.some((entrance) => entrance.id === value);
}

function isDirection(value: unknown): value is TripDirection {
  return DIRECTIONS.has(value);
}

// La búsqueda que trae la URL, o null si falta algo o algún valor no vale (un
// enlace a mano o antiguo): Buscar se muestra entonces como si no se hubiera
// buscado nada
export function parseSearchParams(params: Params): TripSearch | null {
  const { entrance, direction, date, time } = params;
  const place = typeof params['place'] === 'string' ? params['place'].trim() : '';
  const margin = parseInteger(params['margin']);
  const seats = parseInteger(params['seats']);
  if (place.length === 0 || place.length > PLACE_MAX_LENGTH) {
    return null;
  }
  if (!isEntrance(entrance) || !isDirection(direction)) {
    return null;
  }
  if (typeof date !== 'string' || !isCalendarDate(date)) {
    return null;
  }
  if (typeof time !== 'string' || !TIME_PATTERN.test(time)) {
    return null;
  }
  if (margin === null || !MARGIN_VALUES.has(margin)) {
    return null;
  }
  if (seats === null || seats < MIN_SEATS || seats > MAX_SEATS) {
    return null;
  }
  return { place, entrance, direction, date, time, margin, seats };
}
