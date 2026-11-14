import { createHash, randomBytes } from 'node:crypto';
import type { SeatRequest } from '../requests/entities/seat-request.entity';
import type { Trip } from '../trips/entities/trip.entity';
import type { TripStatus } from '../trips/trip-status';

// Reglas puras del viaje compartido en directo (sin base de datos, para
// probarlas solas)

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

// Tras terminar o cancelarse el viaje, el enlace aún dice cómo acabó durante
// este tiempo (como el chat del viaje); después deja de funcionar
export const SHARE_TTL_AFTER_END_MS = 24 * HOUR_MS;

// Bytes aleatorios del enlace: 32 (256 bits), imposible de adivinar
const TOKEN_BYTES = 32;
// 32 bytes en base64url, sin relleno
const TOKEN_PATTERN = /^[\w-]{43}$/;

// Desde que hay plaza aceptada (confirmado) hasta que termina (en curso)
export const SHAREABLE_TRIP_STATUSES: ReadonlySet<TripStatus> = new Set([
  'confirmed',
  'in_progress',
]);

export type SharedPassengerState = 'waiting' | 'on_board' | 'finished';

export function generateShareToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

// Solo se guarda la huella del enlace: quien lea la base de datos no puede
// abrir el viaje compartido
export function hashShareToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function isWellFormedShareToken(token: string): boolean {
  return TOKEN_PATTERN.test(token);
}

// ¿El enlace aún enseña el viaje? Mientras está abierto, solo si el pasajero
// sigue con la plaza; al terminar o cancelarse, durante 24 h. Un viaje que
// vuelve a publicado (se cancelaron las plazas) o caducado no se enseña
export function isSharedTripVisible(
  trip: Pick<Trip, 'status' | 'finishedAt' | 'updatedAt'>,
  request: Pick<SeatRequest, 'status'> | null,
  now: Date,
): boolean {
  if (request === null) {
    return false;
  }
  if (SHAREABLE_TRIP_STATUSES.has(trip.status)) {
    return request.status === 'accepted';
  }
  const isEndedWithSeat =
    (trip.status === 'finished' && request.status === 'accepted') ||
    trip.status === 'cancelled';
  const endedAt = trip.finishedAt ?? trip.updatedAt;
  return (
    isEndedWithSeat &&
    now.getTime() - endedAt.getTime() <= SHARE_TTL_AFTER_END_MS
  );
}

export function toSharedPassengerState(
  tripStatus: TripStatus,
  boardedAt: Date | null,
): SharedPassengerState {
  if (!SHAREABLE_TRIP_STATUSES.has(tripStatus)) {
    return 'finished';
  }
  return boardedAt === null ? 'waiting' : 'on_board';
}

// Llegada estimada: con la posición del coche, lo que queda desde ella; sin
// ella, la salida (o el inicio) más la duración de la ruta
export function estimateSharedArrival(
  trip: Pick<Trip, 'startedAt' | 'departureAt'>,
  position: { recordedAt: Date; remainingMin: number } | null,
  routeDurationMin: number | null,
): Date | null {
  if (position !== null) {
    return new Date(
      position.recordedAt.getTime() + position.remainingMin * MINUTE_MS,
    );
  }
  if (routeDurationMin === null) {
    return null;
  }
  const start = trip.startedAt ?? trip.departureAt;
  return new Date(start.getTime() + routeDurationMin * MINUTE_MS);
}
