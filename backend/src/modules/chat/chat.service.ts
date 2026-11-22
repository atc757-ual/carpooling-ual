import { localizedPush } from '../push/localized-push';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, MoreThan, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import { RequestsService } from '../requests/requests.service';
import type { Trip } from '../trips/entities/trip.entity';
import { TripNotFoundError } from '../trips/errors/trip-not-found.error';
import { TripsService } from '../trips/trips.service';
import { PushService } from '../push/push.service';
import { UsersService } from '../users/users.service';
import {
  CHAT_MAX_MESSAGES_PER_MINUTE,
  chatRoleOf,
  type ChatRole,
  isConversationOpen,
  seatKey,
} from './chat-rules';
import { ChatMessage, type QuickReply } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';
import { ChatClosedError } from './errors/chat-closed.error';
import { ChatNotAllowedError } from './errors/chat-not-allowed.error';
import { ChatPassengerInvalidError } from './errors/chat-passenger-invalid.error';
import { ChatRateLimitedError } from './errors/chat-rate-limited.error';

export type ChatMessageInput = { text: string } | { quickReply: QuickReply };

export interface ChatMessageView {
  message: ChatMessage;
  author: { id: string; name: string; avatarKey: string | null };
  authorRole: ChatRole;
  // Si la otra persona de la conversación lo ha leído (solo los propios)
  readByAll: boolean;
}

// Con qué estados del viaje se puede llamar: solo en curso (la recogida y
// el trayecto); antes y después, el chat
const CALLABLE_TRIP_STATUSES: ReadonlySet<string> = new Set(['in_progress']);

// Alguien del viaje a quien se puede llamar
export interface ChatContactView {
  userId: string;
  name: string;
  phone: string;
  role: ChatRole;
}

// Qué conversación pide el usuario: la del viaje con un pasajero. El pasajero
// no lo indica (es él); el conductor, sí
export interface ConversationRef {
  tripId: string;
  passengerId?: string;
}

// Una conversación a la que el usuario tiene acceso
export interface ChatConversation {
  trip: Trip;
  role: ChatRole;
  // El pasajero de la conversación
  passengerId: string;
  // Con quién habla el usuario: el conductor o el pasajero
  otherUserId: string;
}

// Chat de un viaje («Podría» del capítulo 6), directo entre el conductor y
// cada pasajero aceptado: leer y escribir (texto o respuesta rápida). Los
// mensajes del chat común anterior (sin pasajero) se leen en todas las
// conversaciones del viaje, pero ya no se escriben.
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
    private readonly push: PushService,
  ) {}

  // El viaje, el papel del usuario y la otra persona de la conversación; lanza
  // TripNotFoundError, ChatNotAllowedError (no está en el viaje, o es un
  // pasajero que pide la de otro) o ChatPassengerInvalidError (el conductor no
  // dice con qué pasajero aceptado habla)
  async getConversation(
    userId: string,
    { tripId, passengerId }: ConversationRef,
  ): Promise<ChatConversation> {
    const { trip, role, passengerIds } = await this.getAccess(userId, tripId);
    if (role === 'passenger') {
      if (passengerId !== undefined && passengerId !== userId) {
        throw new ChatNotAllowedError(tripId);
      }
      return { trip, role, passengerId: userId, otherUserId: trip.driverId };
    }
    if (passengerId === undefined || !passengerIds.includes(passengerId)) {
      throw new ChatPassengerInvalidError(tripId, passengerId);
    }
    return { trip, role, passengerId, otherUserId: passengerId };
  }

  // El viaje, el papel del usuario y los pasajeros aceptados; lanza
  // TripNotFoundError o ChatNotAllowedError
  private async getAccess(
    userId: string,
    tripId: string,
  ): Promise<{ trip: Trip; role: ChatRole; passengerIds: string[] }> {
    const trip = (await this.tripsService.getByIds([tripId])).get(tripId);
    if (!trip) {
      throw new TripNotFoundError(tripId);
    }
    const passengers = await this.requestsService.acceptedPassengersByTrip([
      tripId,
    ]);
    const passengerIds = passengers.get(tripId) ?? [];
    const role = chatRoleOf(trip, userId, passengerIds);
    if (!role) {
      throw new ChatNotAllowedError(tripId);
    }
    return { trip, role, passengerIds };
  }

  // A quién puede llamar el usuario: a la otra persona de la conversación o,
  // al conductor que no indica pasajero (las pantallas del viaje), a todos sus
  // pasajeros aceptados. Solo los que comparten su teléfono (verificado) y
  // con el viaje en curso, para la recogida (la Política de privacidad: el
  // teléfono solo lo ven el conductor y los pasajeros aceptados de un viaje,
  // si quien viaja decide compartirlo)
  async contacts(
    userId: string,
    ref: ConversationRef,
  ): Promise<ChatContactView[]> {
    const { trip, contactIds } = await this.contactIdsOf(userId, ref);
    if (!CALLABLE_TRIP_STATUSES.has(trip.status)) {
      return [];
    }
    const phones = await this.usersService.getSharedPhones(contactIds);
    return contactIds.flatMap((id) => {
      const contact = phones.get(id);
      if (!contact) {
        return [];
      }
      const role: ChatRole = id === trip.driverId ? 'driver' : 'passenger';
      return [{ userId: id, ...contact, role }];
    });
  }

  private async contactIdsOf(
    userId: string,
    ref: ConversationRef,
  ): Promise<{ trip: Trip; contactIds: string[] }> {
    if (ref.passengerId === undefined) {
      const { trip, role, passengerIds } = await this.getAccess(
        userId,
        ref.tripId,
      );
      return {
        trip,
        contactIds: role === 'driver' ? passengerIds : [trip.driverId],
      };
    }
    const { trip, otherUserId } = await this.getConversation(userId, ref);
    return { trip, contactIds: [otherUserId] };
  }

  // Del más antiguo al más nuevo (los del chat común anterior, que son más
  // antiguos, primero); con after, solo los posteriores a ese
  async list(
    userId: string,
    ref: ConversationRef,
    page: PageRequest & { after?: string },
  ): Promise<Page<ChatMessageView>> {
    const { trip, passengerId, otherUserId } = await this.getConversation(
      userId,
      ref,
    );
    const otherRead = await this.dataSource
      .getRepository(ChatRead)
      .findOneBy({ tripId: trip.id, passengerId, userId: otherUserId });

    const qb = this.messagesRepository
      .createQueryBuilder('m')
      .where('m.tripId = :tripId', { tripId: trip.id })
      .andWhere('(m.passengerId = :passengerId OR m.passengerId IS NULL)', {
        passengerId,
      })
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
    const readByOther = (m: ChatMessage) =>
      m.passengerId !== null &&
      m.authorId === userId &&
      otherRead !== null &&
      m.createdAt.getTime() <= otherRead.lastReadAt.getTime();
    return {
      items: await this.toViews(trip, messages, readByOther),
      total,
    };
  }

  async send(
    userId: string,
    ref: ConversationRef,
    input: ChatMessageInput,
  ): Promise<ChatMessageView> {
    const { trip, role, passengerId, otherUserId } = await this.getConversation(
      userId,
      ref,
    );
    const closedSeats = await this.requestsService.completedSeatKeys([trip.id]);
    if (
      !isConversationOpen(trip, closedSeats.has(seatKey(trip.id, passengerId)))
    ) {
      throw new ChatClosedError(trip.id);
    }
    await this.assertUnderRateLimit(userId);
    const tripId = trip.id;
    const message = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(ChatMessage, {
          tripId,
          passengerId,
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
        { tripId, passengerId, userId, lastReadAt: saved.createdAt },
        ['tripId', 'passengerId', 'userId'],
      );
      // Sin el texto: el Gemelo Digital no lo necesita (minimización)
      await this.eventsService.record(manager, {
        type: 'chat_message.sent',
        sourceEntityId: saved.id,
        payload: {
          tripId,
          passengerId,
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
    // Ya guardado: a la otra persona, quién ha escrito (no lo que dice)
    const data = { type: 'chat_message', tripId, passengerId };
    this.push.queue(
      this.dataSource.manager,
      [otherUserId],
      localizedPush('chat_message', data, { name: view.author.name }),
    );
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
    readByOther?: (message: ChatMessage) => boolean,
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
          name: profile?.name ?? '',
          avatarKey: profile?.avatarKey ?? null,
        },
        authorRole: message.authorId === trip.driverId ? 'driver' : 'passenger',
        readByAll: readByOther ? readByOther(message) : false,
      };
    });
  }
}
