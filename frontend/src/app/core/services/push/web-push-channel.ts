import { initializeApp } from '@firebase/app';
import {
  getMessaging,
  isSupported,
  type Messaging,
  onMessage,
  onRegistered,
  register,
  unregister,
} from '@firebase/messaging';
import { environment } from '../../../../environments/environment';
import type { PushChannel, PushPermission, PushTarget } from './push-channel';

const SERVICE_WORKER_URL = '/push-sw.js';
// Cuánto se espera a que Firebase entregue el FID tras registrarse
const REGISTER_TIMEOUT_MS = 15_000;

// Las push en el navegador: Web Push con Firebase Cloud Messaging y un service
// worker propio (public/push-sw.js) que las muestra con la app cerrada y, al
// pulsarlas, avisa a la app abierta (mensaje push-open) o la abre en
// /tabs/push-open. En iPhone solo con la web en la pantalla de inicio
export class WebPushChannel implements PushChannel {
  readonly platform = 'web' as const;
  private messaging: Messaging | null = null;

  async isAvailable(): Promise<boolean> {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }
    return isSupported().catch(() => false);
  }

  checkPermission(): Promise<PushPermission> {
    return Promise.resolve(toPermission(Notification.permission));
  }

  async requestPermission(): Promise<PushPermission> {
    return toPermission(await Notification.requestPermission());
  }

  // Firebase recomienda identificar el navegador por su FID (el id de la
  // instalación, lo que la API guarda como su token) en vez de por un token:
  // register() lo entrega por onRegistered, no como resultado
  async getToken(): Promise<string> {
    const registration = await navigator.serviceWorker.register(SERVICE_WORKER_URL);
    const messaging = this.getMessaging();
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

  deleteToken(): Promise<void> {
    return unregister(this.getMessaging());
  }

  listen(onReceive: () => void, onTap: (target: PushTarget) => void): void {
    onMessage(this.getMessaging(), onReceive);
    navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
      const message = event.data as { type?: string; data?: PushTarget } | null;
      if (message?.type === 'push-open' && message.data) {
        onTap(message.data);
      }
    });
  }

  private getMessaging(): Messaging {
    this.messaging ??= getMessaging(initializeApp(environment.firebase));
    return this.messaging;
  }
}

function toPermission(permission: NotificationPermission): PushPermission {
  return permission === 'default' ? 'prompt' : permission;
}
