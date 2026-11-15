import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import {
  ChatContact,
  ChatMessage,
  ChatMessageInput,
  ChatRole,
  Conversation,
  ConversationRef,
} from '../../models/chat.model';

export const CONVERSATIONS_PAGE_SIZE = 10;

// El viaje en curso del usuario y si lo conduce o va de pasajero
export interface LiveTrip {
  tripId: string;
  myRole: ChatRole;
}

export interface ConversationListOptions {
  offset?: number;
  limit?: number;
  hasUnread?: boolean;
}

export interface ConversationPage {
  items: Conversation[];
  total: number;
}

// El id de una conversación en la app: «viaje:pasajero» (como el de la API)
// o, sin pasajero (la del pasajero con el conductor), solo el viaje
export function conversationIdOf({ tripId, passengerId }: ConversationRef): string {
  return passengerId ? `${tripId}:${passengerId}` : tripId;
}

export function parseConversationId(id: string): ConversationRef {
  const [tripId, passengerId] = id.split(':');
  return passengerId ? { tripId, passengerId } : { tripId };
}

// Si una conversación de la lista es la que se indica (sin pasajero, la única
// del pasajero en ese viaje)
export function isSameConversation(conversation: Conversation, ref: ConversationRef): boolean {
  return (
    conversation.trip.id === ref.tripId &&
    (!ref.passengerId || conversation.passenger.id === ref.passengerId)
  );
}

// Mensajes de una conversación que se piden de una vez (los más antiguos
// primero; una conversación de un viaje rara vez pasa de esto)
const MESSAGES_LIMIT = 100;

// Chat del viaje, directo entre el conductor y cada pasajero aceptado (el
// conductor indica el pasajero; el pasajero habla con el conductor): las
// conversaciones, sus mensajes (con after, solo los nuevos), enviar y marcar
// leído. hasUnread es el punto de la pestaña Mensajes; se actualiza con
// refreshUnread. Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly unreadCountState = signal(0);

  readonly unreadConversationCount = this.unreadCountState.asReadonly();
  readonly hasUnread = computed(() => this.unreadConversationCount() > 0);
  // La última conversación marcada como leída: la lista de Mensajes (en
  // escritorio, a la izquierda del chat) pone su contador a cero sin recargar
  private readonly lastReadState = signal<ConversationRef | null>(null);
  readonly lastRead = this.lastReadState.asReadonly();
  private readonly liveTripState = signal<LiveTrip | null>(null);
  // El viaje en curso (o null): lo abre la pestaña del coche. Sale del chat,
  // que tienen el conductor y sus pasajeros aceptados; se actualiza con
  // refreshLiveTrip
  readonly liveTrip = this.liveTripState.asReadonly();

  // Con hasUnread=true y limit=1, X-Total-Count dice si hay algo nuevo. Si
  // falla, se queda como estaba: el punto no es motivo para un error
  async refreshUnread(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<unknown[]>(`${environment.apiUrl}/users/me/conversations`, {
          params: { hasUnread: true, limit: 1 },
          observe: 'response',
        }),
      );
      this.unreadCountState.set(Number(response.headers.get('X-Total-Count') ?? 0));
    } catch {
      // Se vuelve a intentar en la siguiente navegación
    }
  }

  // Si falla, se queda como estaba (se vuelve a intentar al navegar)
  async refreshLiveTrip(): Promise<void> {
    try {
      const [conversation] = await firstValueFrom(
        this.http.get<Conversation[]>(`${environment.apiUrl}/users/me/conversations`, {
          params: { tripStatus: 'in_progress', limit: 1 },
        }),
      );
      this.liveTripState.set(
        conversation ? { tripId: conversation.trip.id, myRole: conversation.myRole } : null,
      );
    } catch {
      // Se vuelve a intentar en la siguiente navegación
    }
  }

  listConversations(): Promise<Conversation[]> {
    return this.listConversationsPage({ limit: 100 }).then(({ items }) => items);
  }

  getConversation(ref: ConversationRef): Promise<Conversation> {
    return this.call(
      this.http.get<Conversation>(`${environment.apiUrl}/trips/${ref.tripId}/conversation`, {
        params: conversationParams(ref),
      }),
    );
  }

  listConversationsPage(options: ConversationListOptions = {}): Promise<ConversationPage> {
    const params: Record<string, string | number | boolean> = {
      offset: options.offset ?? 0,
      limit: options.limit ?? CONVERSATIONS_PAGE_SIZE,
    };
    if (options.hasUnread) params['hasUnread'] = true;
    return this.call(
      this.http.get<Conversation[]>(`${environment.apiUrl}/users/me/conversations`, {
        params,
        observe: 'response',
      }),
    ).then((response) => ({
      items: response.body ?? [],
      total: Number(response.headers.get('X-Total-Count') ?? 0),
    }));
  }

  // Del más antiguo al más nuevo (los del chat común anterior, primero); con
  // after, solo los posteriores a ese
  listMessages(ref: ConversationRef, after?: string): Promise<ChatMessage[]> {
    const params: Record<string, string | number> = {
      ...conversationParams(ref),
      limit: MESSAGES_LIMIT,
    };
    if (after) {
      params['after'] = after;
    }
    return this.call(this.http.get<ChatMessage[]>(this.messagesUrl(ref.tripId), { params }));
  }

  send(ref: ConversationRef, input: ChatMessageInput): Promise<ChatMessage> {
    return this.call(
      this.http.post<ChatMessage>(this.messagesUrl(ref.tripId), input, {
        params: conversationParams(ref),
      }),
    );
  }

  // Denuncia la conversación: llega al administrador como incidencia, con
  // una copia de la conversación (la hace la API)
  async reportChat(ref: ConversationRef, reason: string): Promise<void> {
    await this.call(
      this.http.post<unknown>(
        `${environment.apiUrl}/trips/${ref.tripId}/chat/report`,
        { reason },
        { params: conversationParams(ref) },
      ),
    );
  }

  // A quién puedo llamar (con el teléfono verificado y el viaje confirmado o
  // en curso): el pasajero, al conductor; el conductor, al pasajero indicado
  // o, sin él (las pantallas del viaje), a todos sus pasajeros
  listContacts(ref: ConversationRef): Promise<ChatContact[]> {
    return this.call(
      this.http.get<ChatContact[]>(`${environment.apiUrl}/trips/${ref.tripId}/contacts`, {
        params: conversationParams(ref),
      }),
    );
  }

  async markRead(ref: ConversationRef): Promise<void> {
    await this.call(
      this.http.put<void>(`${this.messagesUrl(ref.tripId)}/read`, null, {
        params: conversationParams(ref),
      }),
    );
    // Un objeto nuevo cada vez: avisa aunque sea la misma conversación
    this.lastReadState.set({ ...ref });
    void this.refreshUnread();
  }

  private messagesUrl(tripId: string): string {
    return `${environment.apiUrl}/trips/${tripId}/messages`;
  }

  private async call<T>(request: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(request);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}

// El pasajero de la conversación, si se indica
function conversationParams({ passengerId }: ConversationRef): Record<string, string> {
  return passengerId ? { passengerId } : {};
}
