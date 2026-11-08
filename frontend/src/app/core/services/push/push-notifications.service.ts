import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PUSH_CHANNEL, PushPermission, PushTarget } from './push-channel';

export type { PushTarget } from './push-channel';

// unsupported: este dispositivo no tiene push (p. ej. Safari sin instalar la
// web); denied: el usuario las bloqueó; off / on
export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

const TOKEN_KEY = 'push.token';

// Notificaciones push (Firebase Cloud Messaging), en el navegador y en la app
// Android por el mismo camino (PushChannel): las activa el usuario en Mi
// perfil o cuando se le ofrecen (PermissionPromptsService); el token se
// registra en la API y se quita al desactivarlas o al cerrar sesión. Al pulsar
// una push se abre la misma pantalla que su aviso (lo hacen las pestañas)
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly channel = inject(PUSH_CHANNEL);
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationsService);
  private readonly chat = inject(ChatService);
  private readonly url = `${environment.apiUrl}/users/me/push-tokens`;
  private isListening = false;
  private openHandler: ((target: PushTarget) => void) | null = null;

  readonly status = signal<PushStatus>('off');

  constructor() {
    this.auth.onBeforeLogout(() => this.unregister());
  }

  // Al entrar en la app: el estado de este dispositivo y, si estaban
  // activadas, renueva el token (puede cambiar)
  async start(): Promise<void> {
    if (!(await this.isAvailable())) {
      this.status.set('unsupported');
      return;
    }
    this.listen();
    const permission = await this.channel.checkPermission();
    const token = await this.preferences.get(TOKEN_KEY);
    if (permission === 'granted' && token) {
      this.status.set('on');
      await this.register().catch(() => undefined);
      return;
    }
    this.status.set(toStatus(permission));
  }

  // Pide el permiso y registra el token; false si no se da
  async enable(): Promise<boolean> {
    if (!(await this.isAvailable())) {
      this.status.set('unsupported');
      return false;
    }
    const permission = await this.channel.requestPermission();
    if (permission !== 'granted') {
      this.status.set(toStatus(permission));
      return false;
    }
    await this.register();
    this.listen();
    this.status.set('on');
    return true;
  }

  async disable(): Promise<void> {
    await this.unregister();
    this.status.set(toStatus(await this.channel.checkPermission()));
  }

  // Quién abre la pantalla al pulsar una push con la app abierta (las
  // pestañas: aquí no se navega)
  onOpen(handler: (target: PushTarget) => void): void {
    this.openHandler = handler;
  }

  private async register(): Promise<void> {
    const token = await this.channel.getToken();
    await firstValueFrom(this.http.put<void>(this.url, { token, platform: this.channel.platform }));
    await this.preferences.set(TOKEN_KEY, token);
  }

  // Quita el token de la API y del dispositivo. Sin token guardado, nada
  private async unregister(): Promise<void> {
    const token = await this.preferences.get(TOKEN_KEY);
    if (!token) {
      return;
    }
    await this.preferences.remove(TOKEN_KEY);
    await firstValueFrom(this.http.delete<void>(this.url, { params: { token } })).catch(
      () => undefined,
    );
    await this.channel.deleteToken().catch(() => undefined);
  }

  // Con la app abierta la push no se muestra: se actualizan los avisos y el
  // punto de Mensajes. Al pulsar una, se abre su pantalla
  private listen(): void {
    if (this.isListening) {
      return;
    }
    this.isListening = true;
    this.channel.listen(
      () => {
        void this.notifications.refreshUnread();
        void this.chat.refreshUnread();
      },
      (target) => this.openHandler?.(target),
    );
  }

  private isAvailable(): Promise<boolean> {
    return this.channel.isAvailable().catch(() => false);
  }
}

function toStatus(permission: PushPermission): PushStatus {
  return permission === 'denied' ? 'denied' : 'off';
}
