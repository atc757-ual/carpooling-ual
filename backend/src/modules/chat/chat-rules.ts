import type { Trip } from '../trips/entities/trip.entity';

// Mensajes por minuto y usuario (evita abusos)
export const CHAT_MAX_MESSAGES_PER_MINUTE = 20;
// Los mensajes de un viaje terminado o cancelado se conservan 30 días: hasta
// entonces su conversación sale en la lista; después se borran (RGPD)
export const CHAT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

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

// Admite mensajes mientras el viaje esté confirmado (con pasajeros) o en curso.
// Una vez finalizado, publicado (sin pasajeros) o cancelado, pasa a solo lectura
export function isChatOpen(trip: ChatTrip): boolean {
  return trip.status === 'confirmed' || trip.status === 'in_progress';
}
