import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { RequestsService } from '../requests/requests.service';
import type { Trip } from '../trips/entities/trip.entity';
import { TripsService } from '../trips/trips.service';
import { CHAT_RETENTION_MS, type ChatRole, isChatOpen } from './chat-rules';
import { ChatMessageView, ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';

export interface ConversationView {
  trip: Trip;
  myRole: ChatRole;
  lastMessage: ChatMessageView | null;
  unreadCount: number;
  isOpen: boolean;
}

// Las conversaciones de un usuario: las de los viajes donde conduce o tiene
// plaza aceptada que admiten mensajes o ya tienen alguno; con el último
// mensaje y los no leídos (los de los demás después de su última lectura)
@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(ChatRead)
    private readonly readsRepository: Repository<ChatRead>,
    private readonly chat: ChatService,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
  ) {}

  // La más reciente primero (último mensaje o, sin mensajes, último cambio
  // del viaje); con hasUnread, solo las que tienen mensajes nuevos (su total
  // es el punto de la pestaña Mensajes)
  async listForUser(
    userId: string,
    filter: { hasUnread?: boolean },
    page: PageRequest,
  ): Promise<Page<ConversationView>> {
    const acceptedTripIds =
      await this.requestsService.acceptedTripIdsOfPassenger(userId);
    const trips = await this.tripsService.findChatTripsForParticipant(
      userId,
      acceptedTripIds,
      new Date(Date.now() - CHAT_RETENTION_MS),
    );
    const tripIds = trips.map(({ id }) => id);
    const [lastMessages, unread] = await Promise.all([
      this.lastMessages(tripIds),
      this.unreadCounts(userId, tripIds),
    ]);
    const conversations = trips
      .map((trip) => ({
        trip,
        lastMessage: lastMessages.get(trip.id) ?? null,
        unreadCount: unread.get(trip.id) ?? 0,
        isOpen: isChatOpen(trip),
      }))
      .filter(({ isOpen, lastMessage }) => isOpen || lastMessage !== null)
      .filter(({ unreadCount }) => !filter.hasUnread || unreadCount > 0)
      .sort((a, b) => lastActivity(b) - lastActivity(a));
    const pageItems = conversations.slice(
      page.offset,
      page.offset + page.limit,
    );
    const views = await Promise.all(
      pageItems.map(async ({ trip, lastMessage, ...rest }) => ({
        trip,
        myRole:
          trip.driverId === userId
            ? ('driver' as const)
            : ('passenger' as const),
        lastMessage: lastMessage
          ? (await this.chat.toViews(trip, [lastMessage]))[0]
          : null,
        ...rest,
      })),
    );
    return { items: views, total: conversations.length };
  }

  async markRead(userId: string, tripId: string): Promise<void> {
    await this.chat.getAccess(userId, tripId);
    // Con la hora de la base de datos, la misma que la de los mensajes
    await this.readsRepository.query(
      `INSERT INTO chat_reads (trip_id, user_id, last_read_at) VALUES ($1, $2, now())
       ON CONFLICT (trip_id, user_id) DO UPDATE SET last_read_at = now()`,
      [tripId, userId],
    );
  }

  // El último mensaje de cada viaje
  private async lastMessages(
    tripIds: string[],
  ): Promise<Map<string, ChatMessage>> {
    if (tripIds.length === 0) {
      return new Map();
    }
    const ids = await this.messagesRepository.query<{ id: string }[]>(
      `SELECT DISTINCT ON (trip_id) id
         FROM chat_messages
        WHERE trip_id = ANY($1)
        ORDER BY trip_id, created_at DESC, id DESC`,
      [tripIds],
    );
    const messages = await this.messagesRepository.findBy({
      id: In(ids.map(({ id }) => id)),
    });
    return new Map(messages.map((message) => [message.tripId, message]));
  }

  // Los mensajes de los demás posteriores a la última lectura del usuario
  private async unreadCounts(
    userId: string,
    tripIds: string[],
  ): Promise<Map<string, number>> {
    if (tripIds.length === 0) {
      return new Map();
    }
    const rows = await this.messagesRepository.query<
      { trip_id: string; count: number }[]
    >(
      `SELECT m.trip_id, COUNT(*)::int AS count
         FROM chat_messages m
         LEFT JOIN chat_reads r ON r.trip_id = m.trip_id AND r.user_id = $1
        WHERE m.trip_id = ANY($2)
          AND m.author_id <> $1
          AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
        GROUP BY m.trip_id`,
      [userId, tripIds],
    );
    return new Map(rows.map(({ trip_id, count }) => [trip_id, count]));
  }
}

function lastActivity({
  trip,
  lastMessage,
}: {
  trip: Trip;
  lastMessage: ChatMessage | null;
}): number {
  return (lastMessage?.createdAt ?? trip.updatedAt).getTime();
}
