// Lo que un gemelo necesita de un evento: el sobre común de DP-05
// (docs/api/events.md). Es una interfaz propia y no la entidad de TypeORM para
// que los gemelos sean clases puras, reutilizables como agentes en cada
// réplica de la simulación (DP-10)
export interface TwinEvent {
  id: string;
  sequence: number;
  type: string;
  version: number;
  sourceEntityId: string;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

// { "type": "Point", "coordinates": [longitud, latitud] } (RFC 7946)
export interface TwinPoint {
  type: 'Point';
  coordinates: [number, number];
}

// Lectores del payload: si un campo no tiene el tipo esperado, se toma como
// ausente en vez de romper la sincronización
export function readString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

export function readNumber(
  payload: Record<string, unknown>,
  key: string,
): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readDate(
  payload: Record<string, unknown>,
  key: string,
): Date | null {
  const value = readString(payload, key);
  return value === null ? null : new Date(value);
}

export function readPoint(
  payload: Record<string, unknown>,
  key: string,
): TwinPoint | null {
  const value = payload[key] as Partial<TwinPoint> | null | undefined;
  const coordinates = value?.coordinates;
  return value?.type === 'Point' &&
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((n) => typeof n === 'number')
    ? { type: 'Point', coordinates: [coordinates[0], coordinates[1]] }
    : null;
}
