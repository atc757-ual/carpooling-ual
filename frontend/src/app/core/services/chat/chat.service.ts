import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { ChatContact, ChatMessage, ChatMessageInput, Conversation } from '../../models/chat.model';

export const CONVERSATIONS_PAGE_SIZE = 10;

export interface ConversationListOptions {
  offset?: number;
  limit?: number;
  hasUnread?: boolean;
}

export interface ConversationPage {
  items: Conversation[];
  total: number;
}

// Mensajes de una conversación que se piden de una vez (los más antiguos
// primero; una conversación de un viaje rara vez pasa de esto)
const MESSAGES_LIMIT = 100;

// Chat del viaje entre el conductor y sus pasajeros aceptados: las
// conversaciones, sus mensajes (con after, solo los nuevos), enviar y marcar
// leído. hasUnread es el punto de la pestaña Mensajes; se actualiza con
// refreshUnread. Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly unreadCountState = signal(0);

  readonly unreadConversationCount = this.unreadCountState.asReadonly();
  readonly hasUnread = computed(() => this.unreadConversationCount() > 0);

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

  listConversations(): Promise<Conversation[]> {
    return this.listConversationsPage({ limit: 100 }).then(({ items }) => items);
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

  // Del más antiguo al más nuevo; con after, solo los posteriores a ese
  listMessages(tripId: string, after?: string): Promise<ChatMessage[]> {
    const params: Record<string, string | number> = { limit: MESSAGES_LIMIT };
    if (after) {
      params['after'] = after;
    }
    return this.call(this.http.get<ChatMessage[]>(`${this.messagesUrl(tripId)}`, { params }));
  }

  send(tripId: string, input: ChatMessageInput): Promise<ChatMessage> {
    return this.call(this.http.post<ChatMessage>(this.messagesUrl(tripId), input));
  }

  // Denuncia el mensaje de otro: llega al administrador como incidencia
  async reportMessage(tripId: string, messageId: string, reason: string): Promise<void> {
    await this.call(
      this.http.post<unknown>(`${this.messagesUrl(tripId)}/${messageId}/report`, { reason }),
    );
  }

  // A quién puedo llamar desde el chat (con el teléfono verificado y el chat
  // abierto): el pasajero, al conductor; el conductor, a sus pasajeros
  listContacts(tripId: string): Promise<ChatContact[]> {
    return this.call(
      this.http.get<ChatContact[]>(`${environment.apiUrl}/trips/${tripId}/contacts`),
    );
  }

  async markRead(tripId: string): Promise<void> {
    await this.call(this.http.put<void>(`${this.messagesUrl(tripId)}/read`, null));
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
