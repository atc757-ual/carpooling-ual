import { ApiProperty } from '@nestjs/swagger';
import { tripHref } from '../../trips/dto/trip.resource';
import { TRIP_STATUSES, type TripStatus } from '../../trips/trip-status';
import type { ChatMessageView } from '../chat.service';
import type { ConversationView } from '../conversations.service';
import {
  CHAT_MESSAGE_KINDS,
  type ChatMessageKind,
  MAX_CHAT_MESSAGE_LENGTH,
  QUICK_REPLIES,
  type QuickReply,
} from '../entities/chat-message.entity';

const CHAT_ROLES = ['driver', 'passenger'] as const;
type ChatRoleValue = (typeof CHAT_ROLES)[number];

export class ChatAuthorResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    description: 'First name and the initial of the surname',
    example: 'Carlos R.',
  })
  name: string;

  @ApiProperty({ type: String, nullable: true, example: 'sun' })
  avatarKey: string | null;
}

// Recurso TMF630 ChatMessage: texto o respuesta rápida (su clave; el texto lo
// pone la app en su idioma)
export class ChatMessageResource {
  @ApiProperty({ enum: ['ChatMessage'] })
  '@type': 'ChatMessage';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: ChatAuthorResource })
  author: ChatAuthorResource;

  @ApiProperty({ enum: CHAT_ROLES })
  authorRole: ChatRoleValue;

  @ApiProperty({ enum: CHAT_MESSAGE_KINDS })
  kind: ChatMessageKind;

  @ApiProperty({
    type: String,
    nullable: true,
    maxLength: MAX_CHAT_MESSAGE_LENGTH,
  })
  text: string | null;

  @ApiProperty({ enum: QUICK_REPLIES, nullable: true })
  quickReply: QuickReply | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export class ConversationTripResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ type: String, nullable: true, example: 'Roquetas de Mar' })
  originName: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Campus UAL · Parking P1 (Sur)',
  })
  destinationName: string | null;

  @ApiProperty({ format: 'date-time' })
  departureAt: string;

  @ApiProperty({ enum: TRIP_STATUSES })
  status: TripStatus;

  @ApiProperty({ description: 'Public display name of the trip driver' })
  driverName: string;

  @ApiProperty({ type: String, nullable: true, example: 'sun' })
  driverAvatarKey: string | null;
}

// Recurso TMF630 Conversation: el chat de un viaje para el usuario (su id es
// el del viaje)
export class ConversationResource {
  @ApiProperty({ enum: ['Conversation'] })
  '@type': 'Conversation';

  @ApiProperty({ format: 'uuid', description: 'The trip id' })
  id: string;

  @ApiProperty({
    example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90/messages',
  })
  href: string;

  @ApiProperty({ type: ConversationTripResource })
  trip: ConversationTripResource;

  @ApiProperty({ enum: CHAT_ROLES })
  myRole: ChatRoleValue;

  @ApiProperty({ type: ChatMessageResource, nullable: true })
  lastMessage: ChatMessageResource | null;

  @ApiProperty({
    description: 'Messages of the others after my last read',
    example: 2,
  })
  unreadCount: number;

  @ApiProperty({
    description:
      'True while new messages are accepted: trip confirmed or in progress, or finished less than 24 h ago',
  })
  isOpen: boolean;
}

export function toChatMessageResource({
  message,
  author,
  authorRole,
}: ChatMessageView): ChatMessageResource {
  return {
    '@type': 'ChatMessage',
    id: message.id,
    author,
    authorRole,
    kind: message.kind,
    text: message.body,
    quickReply: message.quickReply,
    createdAt: message.createdAt.toISOString(),
  };
}

export function toConversationResource(
  view: ConversationView,
): ConversationResource {
  const { trip } = view;
  return {
    '@type': 'Conversation',
    id: trip.id,
    href: `${tripHref(trip.id)}/messages`,
    trip: {
      id: trip.id,
      href: tripHref(trip.id),
      originName: trip.originName,
      destinationName: trip.destinationName,
      departureAt: trip.departureAt.toISOString(),
      status: trip.status,
      driverName: view.driver.name,
      driverAvatarKey: view.driver.avatarKey,
    },
    myRole: view.myRole,
    lastMessage: view.lastMessage
      ? toChatMessageResource(view.lastMessage)
      : null,
    unreadCount: view.unreadCount,
    isOpen: view.isOpen,
  };
}
