import {
  SearchParking,
  SearchPlace,
  TripDirection,
  TripSearch,
} from '../../core/models/trip-search.model';

export const PLACE_MAX_LENGTH = 120;
const ID_MAX_LENGTH = 200;
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

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

// [longitud, latitud] dentro de sus rangos
function isCoordinates(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
    Math.abs(value[0] as number) <= 180 &&
    Math.abs(value[1] as number) <= 90
  );
}

function isPlace(value: unknown): value is SearchPlace {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { id, name, locality, coordinates } = value as Record<string, unknown>;
  return (
    isText(id, ID_MAX_LENGTH) &&
    isText(name, PLACE_MAX_LENGTH) &&
    isText(locality, PLACE_MAX_LENGTH) &&
    isCoordinates(coordinates)
  );
}

function isParking(value: unknown): value is SearchParking {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const { id, name } = value as Record<string, unknown>;
  return isText(id, ID_MAX_LENGTH) && isText(name, PLACE_MAX_LENGTH);
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
  const { place, parking, direction, date, time, margin, seats } = value as Record<string, unknown>;
  const isValid =
    isPlace(place) &&
    isParking(parking) &&
    isDirection(direction) &&
    isCalendarDate(date) &&
    isTime(time) &&
    MARGIN_VALUES.has(margin) &&
    isSeats(seats);
  if (!isValid) {
    return null;
  }
  // Solo los campos conocidos (lo guardado puede traer otros)
  return {
    place: {
      id: place.id,
      name: place.name,
      locality: place.locality,
      coordinates: [place.coordinates[0], place.coordinates[1]],
    },
    parking: { id: parking.id, name: parking.name },
    direction,
    date,
    time,
    margin: Number(margin),
    seats,
  };
}
