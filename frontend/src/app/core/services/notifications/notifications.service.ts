import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { AppNotification } from '../../models/notification.model';

// Los más recientes: los de hace tiempo ya no ayudan
const MY_NOTIFICATIONS_LIMIT = 50;

// Avisos de la persona (RF-19): verlos, cuántos quedan sin leer y marcarlos
// como leídos. El número sin leer se comparte (la campana y la pestaña) y se
// actualiza con refreshUnread. Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly unread = signal(0);

  readonly unreadCount = this.unread.asReadonly();

  // Mis avisos, los más recientes primero
  list(): Promise<AppNotification[]> {
    return this.call(
      this.http.get<AppNotification[]>(`${this.apiUrl}/users/me/notifications`, {
        params: { limit: MY_NOTIFICATIONS_LIMIT },
      }),
    );
  }

  // Con isRead=false, X-Total-Count es el número de avisos sin leer. Si falla,
  // se queda el número que había: la campana no es motivo para un error
  async refreshUnread(): Promise<void> {
    try {
      const response = await firstValueFrom(
        this.http.get<AppNotification[]>(`${this.apiUrl}/users/me/notifications`, {
          params: { isRead: false, limit: 1 },
          observe: 'response',
        }),
      );
      this.unread.set(Number(response.headers.get('X-Total-Count') ?? 0));
    } catch {
      // Se vuelve a intentar en la siguiente navegación
    }
  }

  async markRead(notificationId: string): Promise<void> {
    await this.call(
      this.http.post<AppNotification>(`${this.apiUrl}/notifications/${notificationId}/read`, null),
    );
    this.unread.update((count) => Math.max(count - 1, 0));
  }

  async markAllRead(): Promise<void> {
    await this.call(this.http.post<void>(`${this.apiUrl}/users/me/notifications/read`, null));
    this.unread.set(0);
  }

  private async call<T>(response: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(response);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
