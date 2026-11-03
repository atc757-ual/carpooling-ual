import { readFileSync } from 'node:fs';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { PushMessage, PushSender } from './push-sender';

// Lo más que admite FCM en un envío a varios dispositivos
const MAX_TOKENS_PER_REQUEST = 500;
// Errores de FCM de un token que ya no sirve: se borra
const INVALID_TOKEN_CODES: ReadonlySet<string> = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);
// Canal de Android de los avisos (lo crea la app): viajes y mensajes
export const ANDROID_CHANNEL_ID = 'trips';

// Envío real con Firebase Cloud Messaging, a la web y a la app Android. La
// cuenta de servicio se lee al arrancar desde su JSON (fuera del repositorio)
export class FcmPushSender extends PushSender {
  constructor(private readonly messaging: Messaging) {
    super();
  }

  static fromServiceAccount(path: string): FcmPushSender {
    const account = JSON.parse(readFileSync(path, 'utf8')) as ServiceAccount;
    const app = initializeApp(
      { credential: cert(account) },
      'carpooling-ual-push',
    );
    return new FcmPushSender(getMessaging(app));
  }

  async send(
    tokens: readonly string[],
    message: PushMessage,
  ): Promise<string[]> {
    const invalid: string[] = [];
    for (
      let start = 0;
      start < tokens.length;
      start += MAX_TOKENS_PER_REQUEST
    ) {
      const batch = tokens.slice(start, start + MAX_TOKENS_PER_REQUEST);
      const { responses } = await this.messaging.sendEachForMulticast({
        tokens: batch,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: { notification: { channelId: ANDROID_CHANNEL_ID } },
      });
      responses.forEach(({ success, error }, index) => {
        if (!success && error && INVALID_TOKEN_CODES.has(error.code)) {
          invalid.push(batch[index]);
        }
      });
    }
    return invalid;
  }
}
