import { TripStatus } from './driver.model';

// Respuestas rápidas: la API guarda la clave y la app pone el texto
export type QuickReply =
  | 'at_pickup'
  | 'running_late'
  | 'on_my_way'
  | 'where_are_you'
  | 'leaving_soon'
  | 'still_going'
  | 'arriving_soon'
  | 'stopping_here';

export type ChatRole = 'driver' | 'passenger';

// Un mensaje del chat de un viaje (GET /api/trips/{id}/messages)
// Alguien del viaje a quien se puede llamar desde el chat
export interface ChatContact {
  id: string;
  name: string;
  phone: string;
  role: ChatRole;
}

export interface ChatMessage {
  id: string;
  author: { id: string; name: string; avatarKey: string | null };
  authorRole: ChatRole;
  kind: 'text' | 'quick';
  text: string | null;
  quickReply: QuickReply | null;
  createdAt: string;
  readByAll?: boolean;
}

// El chat de un viaje para el usuario (GET /api/users/me/conversations); su
// id es el del viaje
export interface Conversation {
  id: string;
  trip: {
    id: string;
    originName: string | null;
    destinationName: string | null;
    departureAt: string;
    status: TripStatus;
    driverName: string;
    driverAvatarKey: string | null;
  };
  myRole: ChatRole;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isOpen: boolean;
}

export type ChatMessageInput = { text: string } | { quickReply: QuickReply };
