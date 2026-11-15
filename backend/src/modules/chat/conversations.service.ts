import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { RequestsService } from '../requests/requests.service';
import { UsersService } from '../users/users.service';
import type { Trip } from '../trips/entities/trip.entity';
import type { TripStatus } from '../trips/trip-status';
import { TripsService } from '../trips/trips.service';
import { CHAT_RETENTION_MS, type ChatRole, isChatOpen } from './chat-rules';
import {
  type ChatMessageView,
  ChatService,
  type ConversationRef,
} from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';

interface PersonView {
  id: string;
  name: string;
  avatarKey: string | null;
}

export interface ConversationView {
  trip: Trip;
  driver: Omit<PersonView, 'id'>;
  // El pasajero de la conversación
  passenger: PersonView;
  myRole: ChatRole;
  lastMessage: ChatMessageView | null;
  unreadCount: number;
  isOpen: boolean;
}

interface ConversationRow {
  trip: Trip;
  passengerId: string;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isOpen: boolean;
}

type Profiles = Map<string, { name: string; avatarKey: string | null }>;

// Las conversaciones de un usuario: en los viajes donde conduce, una con cada
// pasajero aceptado; donde tiene plaza aceptada, la suya con el conductor. Solo
// las que admiten mensajes o ya tienen alguno; con el último mensaje y los no
// leídos (los de la otra persona después de su última lectura). Los mensajes
// del chat común anterior cuentan como último mensaje, nunca como no leídos
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
    private readonly usersService: UsersService,
  ) {}

  // La más reciente primero (último mensaje o, sin mensajes, último cambio
  // del viaje); con hasUnread, solo las que tienen mensajes nuevos (su total
  // es el punto de la pestaña Mensajes); con tripStatus, solo las de los viajes
  // en ese estado (in_progress: el viaje en curso, para la pestaña del coche)
  async listForUser(
    userId: string,
    filter: { hasUnread?: boolean; tripStatus?: TripStatus },
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
    const drivenTripIds = trips
      .filter(({ driverId }) => driverId === userId)
      .map(({ id }) => id);
    const [passengersByTrip, lastMessages, unread] = await Promise.all([
      this.requestsService.acceptedPassengersByTrip(drivenTripIds),
      this.lastMessages(tripIds),
      this.unreadCounts(userId, tripIds),
    ]);
    const conversations = trips
      .flatMap((trip) =>
        (trip.driverId === userId
          ? (passengersByTrip.get(trip.id) ?? [])
          : [userId]
        ).map((passengerId) => ({
          trip,
          passengerId,
          lastMessage: lastMessageOf(lastMessages, trip.id, passengerId),
          unreadCount: unread.get(conversationKey(trip.id, passengerId)) ?? 0,
          isOpen: isChatOpen(trip),
        })),
      )
      .filter(({ isOpen, lastMessage }) => isOpen || lastMessage !== null)
      .filter(({ unreadCount }) => !filter.hasUnread || unreadCount > 0)
      .filter(
        ({ trip }) => !filter.tripStatus || trip.status === filter.tripStatus,
      )
      .sort((a, b) => lastActivity(b) - lastActivity(a));
    const pageItems = conversations.slice(
      page.offset,
      page.offset + page.limit,
    );
    const profiles = await this.usersService.getPublicProfiles(
      pageItems.flatMap(({ trip, passengerId }) => [
        trip.driverId,
        passengerId,
      ]),
    );
    const items = await Promise.all(
      pageItems.map((row) => this.toView(userId, row, profiles)),
    );
    return { items, total: conversations.length };
  }

  // Una conversación concreta del usuario (para el encabezado del chat y
  // viajes terminados)
  async getForTrip(
    userId: string,
    ref: ConversationRef,
  ): Promise<ConversationView> {
    const { trip, passengerId } = await this.chat.getConversation(userId, ref);
    const [lastMessages, unread, profiles] = await Promise.all([
      this.lastMessages([trip.id]),
      this.unreadCounts(userId, [trip.id]),
      this.usersService.getPublicProfiles([trip.driverId, passengerId]),
    ]);
    const row: ConversationRow = {
      trip,
      passengerId,
      lastMessage: lastMessageOf(lastMessages, trip.id, passengerId),
      unreadCount: unread.get(conversationKey(trip.id, passengerId)) ?? 0,
      isOpen: isChatOpen(trip),
    };
    return this.toView(userId, row, profiles);
  }

  async markRead(userId: string, ref: ConversationRef): Promise<void> {
    const { trip, passengerId } = await this.chat.getConversation(userId, ref);
    // Con la hora de la base de datos, la misma que la de los mensajes
    await this.readsRepository.query(
      `INSERT INTO chat_reads (trip_id, passenger_id, user_id, last_read_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (trip_id, passenger_id, user_id)
       DO UPDATE SET last_read_at = now()`,
      [trip.id, passengerId, userId],
    );
  }

  private async toView(
    userId: string,
    { trip, passengerId, lastMessage, unreadCount, isOpen }: ConversationRow,
    profiles: Profiles,
  ): Promise<ConversationView> {
    return {
      trip,
      driver: {
        name: profiles.get(trip.driverId)?.name ?? '',
        avatarKey: profiles.get(trip.driverId)?.avatarKey ?? null,
      },
      passenger: {
        id: passengerId,
        name: profiles.get(passengerId)?.name ?? '',
        avatarKey: profiles.get(passengerId)?.avatarKey ?? null,
      },
      myRole: trip.driverId === userId ? 'driver' : 'passenger',
      lastMessage: lastMessage
        ? (await this.chat.toViews(trip, [lastMessage]))[0]
        : null,
      unreadCount,
      isOpen,
    };
  }

  // El último mensaje de cada conversación de los viajes y el del chat común
  // anterior de cada viaje (clave con el pasajero vacío)
  private async lastMessages(
    tripIds: string[],
  ): Promise<Map<string, ChatMessage>> {
    if (tripIds.length === 0) {
      return new Map();
    }
    const ids = await this.messagesRepository.query<{ id: string }[]>(
      `SELECT DISTINCT ON (trip_id, passenger_id) id
         FROM chat_messages
        WHERE trip_id = ANY($1)
        ORDER BY trip_id, passenger_id, created_at DESC, id DESC`,
      [tripIds],
    );
    const messages = await this.messagesRepository.findBy({
      id: In(ids.map(({ id }) => id)),
    });
    return new Map(
      messages.map((message) => [
        conversationKey(message.tripId, message.passengerId),
        message,
      ]),
    );
  }

  // Los mensajes de la otra persona posteriores a la última lectura del
  // usuario, por conversación (los del chat común anterior no cuentan)
  private async unreadCounts(
    userId: string,
    tripIds: string[],
  ): Promise<Map<string, number>> {
    if (tripIds.length === 0) {
      return new Map();
    }
    const rows = await this.messagesRepository.query<
      { trip_id: string; passenger_id: string; count: number }[]
    >(
      `SELECT m.trip_id, m.passenger_id, COUNT(*)::int AS count
         FROM chat_messages m
         LEFT JOIN chat_reads r
           ON r.trip_id = m.trip_id
          AND r.passenger_id = m.passenger_id
          AND r.user_id = $1
        WHERE m.trip_id = ANY($2)
          AND m.passenger_id IS NOT NULL
          AND m.author_id <> $1
          AND (r.last_read_at IS NULL OR m.created_at > r.last_read_at)
        GROUP BY m.trip_id, m.passenger_id`,
      [userId, tripIds],
    );
    return new Map(
      rows.map(({ trip_id, passenger_id, count }) => [
        conversationKey(trip_id, passenger_id),
        count,
      ]),
    );
  }
}

function conversationKey(tripId: string, passengerId: string | null): string {
  return `${tripId}:${passengerId ?? ''}`;
}

// El más reciente entre el de la conversación y el del chat común anterior
function lastMessageOf(
  lastMessages: Map<string, ChatMessage>,
  tripId: string,
  passengerId: string,
): ChatMessage | null {
  const direct = lastMessages.get(conversationKey(tripId, passengerId));
  const shared = lastMessages.get(conversationKey(tripId, null));
  if (!direct || !shared) {
    return direct ?? shared ?? null;
  }
  return direct.createdAt >= shared.createdAt ? direct : shared;
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
