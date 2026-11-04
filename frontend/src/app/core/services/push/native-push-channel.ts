import { PushNotifications } from '@capacitor/push-notifications';
import type { PushChannel, PushPermission, PushTarget } from './push-channel';

// Lo que se usa del plugin (en los tests se sustituye)
export type NativePushPlugin = Pick<
  typeof PushNotifications,
  | 'checkPermissions'
  | 'requestPermissions'
  | 'register'
  | 'unregister'
  | 'addListener'
  | 'createChannel'
>;

// El canal de Android de los avisos: el mismo id que manda el backend
// (ANDROID_CHANNEL_ID en fcm-push-sender.ts)
export const ANDROID_CHANNEL = {
  id: 'trips',
  name: 'Viajes y mensajes',
  description: 'Solicitudes, plazas, cambios de tus viajes y mensajes del chat',
  importance: 4,
} as const;

// Hasta cuándo se espera el token tras registrarse
const TOKEN_TIMEOUT_MS = 15_000;

// Las push en la app Android (@capacitor/push-notifications con Firebase):
// el permiso del sistema (Android 13+), el canal «Viajes y mensajes» y el
// token, que llega en el evento registration. Al pulsar una push, el plugin
// entrega sus datos para abrir la pantalla. Necesita el google-services.json
// del proyecto de Firebase en android/app/
export class NativePushChannel implements PushChannel {
  readonly platform = 'android' as const;

  constructor(private readonly plugin: NativePushPlugin = PushNotifications) {}

  isAvailable(): Promise<boolean> {
    return Promise.resolve(true);
  }

  async checkPermission(): Promise<PushPermission> {
    return toPermission((await this.plugin.checkPermissions()).receive);
  }

  async requestPermission(): Promise<PushPermission> {
    return toPermission((await this.plugin.requestPermissions()).receive);
  }

  async getToken(): Promise<string> {
    await this.plugin.createChannel(ANDROID_CHANNEL);
    const token = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No push token')), TOKEN_TIMEOUT_MS);
      void this.plugin.addListener('registration', ({ value }) => {
        clearTimeout(timer);
        resolve(value);
      });
      void this.plugin.addListener('registrationError', ({ error }) => {
        clearTimeout(timer);
        reject(new Error(error));
      });
    });
    await this.plugin.register();
    return token;
  }

  async deleteToken(): Promise<void> {
    await this.plugin.unregister();
  }

  listen(onReceive: () => void, onTap: (target: PushTarget) => void): void {
    void this.plugin.addListener('pushNotificationReceived', () => onReceive());
    void this.plugin.addListener('pushNotificationActionPerformed', ({ notification }) => {
      const data = notification.data as Partial<PushTarget> | undefined;
      if (data?.type) {
        onTap({ type: data.type, tripId: data.tripId, requestId: data.requestId });
      }
    });
  }
}

function toPermission(receive: string): PushPermission {
  if (receive === 'granted' || receive === 'denied') {
    return receive;
  }
  return 'prompt';
}
