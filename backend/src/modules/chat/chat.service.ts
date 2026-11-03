import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import { toShortName } from '../../shared/people/short-name';
import { RequestsService } from '../requests/requests.service';
import type { Trip } from '../trips/entities/trip.entity';
import { TripNotFoundError } from '../trips/errors/trip-not-found.error';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import {
  CHAT_MAX_MESSAGES_PER_MINUTE,
  chatRoleOf,
  type ChatRole,
  isChatOpen,
  isQuickRepliesOnly,
} from './chat-rules';
import { ChatMessage, type QuickReply } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';
import { ChatClosedError } from './errors/chat-closed.error';
import { ChatNotAllowedError } from './errors/chat-not-allowed.error';
import { ChatQuickRepliesOnlyError } from './errors/chat-quick-replies-only.error';
import { ChatRateLimitedError } from './errors/chat-rate-limited.error';

export type ChatMessageInput = { text: string } | { quickReply: QuickReply };

export interface ChatMessageView {
  message: ChatMessage;
  author: { id: string; name: string; avatarKey: string | null };
  authorRole: ChatRole;
}

export interface ChatAccess {
  trip: Trip;
  role: ChatRole;
}

// Chat de un viaje entre el conductor y sus pasajeros aceptados («Podría»
// del capítulo 6): leer y escribir (texto o respuesta rápida).
// Usa trips y requests por lo que exportan, sin tocar sus tablas
@Injectable()
export class ChatService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    private readonly tripsService: TripsService,
    private readonly requestsService: RequestsService,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
  ) {}

  // El viaje y el papel del usuario en su chat; lanza TripNotFoundError o
  // ChatNotAllowedError
  async getAccess(userId: string, tripId: string): Promise<ChatAccess> {
    const trip = (await this.tripsService.getByIds([tripId])).get(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }
    const passengers = await this.requestsService.acceptedPassengersByTrip([
      tripId,
    ]);
    const role = chatRoleOf(trip, userId, passengers.get(tripId) ?? []);
    if (!role) {
      throw new ChatNotAllowedError(tripId);
    }
    return { trip, role };
  }

  // Del más antiguo al más nuevo; con after, solo los posteriores a ese
  async list(
    userId: string,
    tripId: string,
    page: PageRequest & { after?: string },
  ): Promise<Page<ChatMessageView>> {
    const { trip } = await this.getAccess(userId, tripId);
    const qb = this.messagesRepository
      .createQueryBuilder('m')
      .where('m.tripId = :tripId', { tripId })
      .orderBy('m.createdAt', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .skip(page.offset)
      .take(page.limit);
    if (page.after) {
      qb.andWhere(
        `(m.createdAt, m.id) > (SELECT created_at, id FROM chat_messages
                                 WHERE id = :after AND trip_id = :tripId)`,
        { after: page.after },
      );
    }
    const [messages, total] = await qb.getManyAndCount();
    return { items: await this.toViews(trip, messages), total };
  }

  async send(
    userId: string,
    tripId: string,
    input: ChatMessageInput,
  ): Promise<ChatMessageView> {
    const { trip, role } = await this.getAccess(userId, tripId);
    if (!isChatOpen(trip)) {
      throw new ChatClosedError(tripId);
    }
    if ('text' in input && isQuickRepliesOnly(trip, role)) {
      throw new ChatQuickRepliesOnlyError(tripId);
    }
    await this.assertUnderRateLimit(userId);
    const message = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(ChatMessage, {
          tripId,
          authorId: userId,
          ...('text' in input
            ? { kind: 'text' as const, body: input.text, quickReply: null }
            : {
                kind: 'quick' as const,
                body: null,
                quickReply: input.quickReply,
              }),
        }),
      );
      // Lo propio no cuenta como no leído
      await manager.upsert(
        ChatRead,
        { tripId, userId, lastReadAt: saved.createdAt },
        ['tripId', 'userId'],
      );
      // Sin el texto: el Gemelo Digital no lo necesita (minimización)
      await this.eventsService.record(manager, {
        type: 'chat_message.sent',
        sourceEntityId: saved.id,
        payload: {
          tripId,
          authorId: userId,
          authorRole: role,
          kind: saved.kind,
          quickReply: saved.quickReply,
          createdAt: saved.createdAt.toISOString(),
        },
      });
      return saved;
    });
    const [view] = await this.toViews(trip, [message]);
    return view;
  }

  private async assertUnderRateLimit(userId: string): Promise<void> {
    const sent = await this.messagesRepository.countBy({
      authorId: userId,
      createdAt: MoreThan(new Date(Date.now() - 60_000)),
    });
    if (sent >= CHAT_MAX_MESSAGES_PER_MINUTE) {
      throw new ChatRateLimitedError(CHAT_MAX_MESSAGES_PER_MINUTE);
    }
  }

  async toViews(
    trip: Pick<Trip, 'driverId'>,
    messages: ChatMessage[],
  ): Promise<ChatMessageView[]> {
    const profiles = await this.usersService.getPublicProfiles(
      messages.map(({ authorId }) => authorId),
    );
    return messages.map((message) => {
      const profile = profiles.get(message.authorId);
      return {
        message,
        author: {
          id: message.authorId,
          name: toShortName(profile?.name ?? ''),
          avatarKey: profile?.avatarKey ?? null,
        },
        authorRole: message.authorId === trip.driverId ? 'driver' : 'passenger',
      };
    });
  }
}
