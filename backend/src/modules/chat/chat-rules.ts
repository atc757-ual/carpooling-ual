import type { Trip } from '../trips/entities/trip.entity';

// Después de terminar el viaje, el chat admite mensajes durante 24 h; luego
// queda de solo lectura
export const CHAT_OPEN_AFTER_FINISH_MS = 24 * 60 * 60 * 1000;
// Mensajes por minuto y usuario (evita abusos)
export const CHAT_MAX_MESSAGES_PER_MINUTE = 20;

export type ChatRole = 'driver' | 'passenger';

// Lo que hace falta del viaje para decidir sobre su chat
export type ChatTrip = Pick<
  Trip,
  'id' | 'driverId' | 'status' | 'finishedAt' | 'updatedAt'
>;

// Quién es en el chat: el conductor o un pasajero aceptado; null si no está
export function chatRoleOf(
  trip: Pick<ChatTrip, 'driverId'>,
  userId: string,
  acceptedPassengerIds: readonly string[],
): ChatRole | null {
  if (trip.driverId === userId) {
    return 'driver';
  }
  return acceptedPassengerIds.includes(userId) ? 'passenger' : null;
}

// Admite mensajes: confirmado (ya con pasajeros), en curso o terminado hace
// menos de 24 h. Publicado (sin pasajeros) o cancelado, no
export function isChatOpen(trip: ChatTrip, now = new Date()): boolean {
  if (trip.status === 'confirmed' || trip.status === 'in_progress') {
    return true;
  }
  if (trip.status !== 'finished') {
    return false;
  }
  const finishedAt = trip.finishedAt ?? trip.updatedAt;
  return now.getTime() - finishedAt.getTime() < CHAT_OPEN_AFTER_FINISH_MS;
}

// Con el viaje en curso, el conductor solo envía respuestas rápidas
export function isQuickRepliesOnly(
  trip: Pick<ChatTrip, 'status'>,
  role: ChatRole,
): boolean {
  return role === 'driver' && trip.status === 'in_progress';
}
