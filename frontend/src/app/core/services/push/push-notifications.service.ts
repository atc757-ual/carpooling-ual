import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { initializeApp } from '@firebase/app';
import {
  getMessaging,
  isSupported,
  Messaging,
  onMessage,
  onRegistered,
  register,
  unregister,
} from '@firebase/messaging';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { AuthService } from '../auth/auth.service';
import { ChatService } from '../chat/chat.service';
import { NotificationsService } from '../notifications/notifications.service';

// Lo que se usa de Firebase Messaging en el navegador (en los tests se
// sustituye): pedir y borrar el FID de este navegador (lo que la API guarda
// como su token) y oír las push que
// llegan con la app abierta
export interface WebMessaging {
  isSupported(): Promise<boolean>;
  getToken(registration: ServiceWorkerRegistration): Promise<string>;
  deleteToken(): Promise<void>;
  onMessage(listener: () => void): void;
}

// Cuánto se espera a que Firebase entregue el FID tras registrarse
const REGISTER_TIMEOUT_MS = 15_000;

// Firebase recomienda identificar el navegador por su FID (el id de la
// instalación) en vez de por un token: register() lo entrega por
// onRegistered, no como resultado, así que se espera al primero que llegue
function registerInstallation(
  messaging: Messaging,
  registration: ServiceWorkerRegistration,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new Error('FCM registration timed out'));
    }, REGISTER_TIMEOUT_MS);
    const stop = onRegistered(messaging, (fid) => {
      clearTimeout(timer);
      stop();
      resolve(fid);
    });
    register(messaging, {
      vapidKey: environment.pushVapidKey,
      serviceWorkerRegistration: registration,
    }).catch((error: unknown) => {
      clearTimeout(timer);
      stop();
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

export const WEB_MESSAGING = new InjectionToken<WebMessaging>('WebMessaging', {
  factory: () => {
    const messaging = () => getMessaging(initializeApp(environment.firebase));
    return {
      isSupported: () => isSupported(),
      getToken: (registration) => registerInstallation(messaging(), registration),
      deleteToken: () => unregister(messaging()),
      onMessage: (listener) => onMessage(messaging(), listener),
    };
  },
});

// A qué se refiere una push al pulsarla (los datos que manda el backend)
export interface PushTarget {
  type: string;
  tripId?: string;
  requestId?: string;
}

// unsupported: este navegador no tiene push (p. ej. Safari sin instalar la
// web); denied: el usuario las bloqueó en el navegador; off / on
export type PushStatus = 'unsupported' | 'denied' | 'off' | 'on';

const TOKEN_KEY = 'push.token';
const SERVICE_WORKER_URL = '/push-sw.js';

// Notificaciones push en el navegador (Firebase Cloud Messaging): las activa
// el usuario en Mi perfil (se pide el permiso entonces, nunca al abrir la
// app); el token se registra en la API y se quita al desactivarlas o al cerrar
// sesión. Al pulsar una push se abre la misma pantalla que su aviso. La app
// nativa usa su propio plugin (PR siguiente)
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly preferences = inject(PreferencesPlugin);
  private readonly messaging = inject(WEB_MESSAGING);
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

  // Al entrar en la app: el estado de este navegador y, si estaban activadas,
  // renueva el token (el navegador puede cambiarlo)
  async start(): Promise<void> {
    if (!(await this.isAvailable())) {
      this.status.set('unsupported');
      return;
    }
    this.listen();
    if (Notification.permission === 'denied') {
      this.status.set('denied');
      return;
    }
    const token = await this.preferences.get(TOKEN_KEY);
    if (token && Notification.permission === 'granted') {
      this.status.set('on');
      await this.register().catch(() => undefined);
      return;
    }
    this.status.set('off');
  }

  // Pide el permiso del navegador y registra el token; false si no se da
  async enable(): Promise<boolean> {
    if (!(await this.isAvailable())) {
      this.status.set('unsupported');
      return false;
    }
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      this.status.set(permission === 'denied' ? 'denied' : 'off');
      return false;
    }
    await this.register();
    this.listen();
    this.status.set('on');
    return true;
  }

  async disable(): Promise<void> {
    await this.unregister();
    this.status.set(Notification.permission === 'denied' ? 'denied' : 'off');
  }

  // Quién abre la pantalla al pulsar una push con la app abierta (las
  // pestañas: aquí no se navega)
  onOpen(handler: (target: PushTarget) => void): void {
    this.openHandler = handler;
  }

  private async register(): Promise<void> {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    const token = await this.messaging.getToken(registration);
    await firstValueFrom(this.http.put<void>(this.url, { token, platform: 'web' }));
    await this.preferences.set(TOKEN_KEY, token);
  }

  // Quita el token de la API y del navegador. Sin token guardado, nada
  private async unregister(): Promise<void> {
    const token = await this.preferences.get(TOKEN_KEY);
    if (!token) {
      return;
    }
    await this.preferences.remove(TOKEN_KEY);
    await firstValueFrom(this.http.delete<void>(this.url, { params: { token } })).catch(
      () => undefined,
    );
    await this.messaging.deleteToken().catch(() => undefined);
  }

  // Con la app abierta la push no se muestra: se actualizan los avisos y el
  // punto de Mensajes. Y al pulsar una push, el service worker avisa aquí
  private listen(): void {
    if (this.isListening) {
      return;
    }
    this.isListening = true;
    this.messaging.onMessage(() => {
      void this.notifications.refreshUnread();
      void this.chat.refreshUnread();
    });
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as { type?: string; data?: PushTarget } | null;
      if (message?.type === 'push-open' && message.data) {
        this.openHandler?.(message.data);
      }
    });
  }

  private async isAvailable(): Promise<boolean> {
    if (Capacitor.isNativePlatform() || !('Notification' in window)) {
      return false;
    }
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    return this.messaging.isSupported().catch(() => false);
  }
}
