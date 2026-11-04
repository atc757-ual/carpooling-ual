import { readFileSync } from 'node:fs';
import { cert, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import {
  getMessaging,
  type BatchResponse,
  type Messaging,
} from 'firebase-admin/messaging';
import { PushMessage, PushRecipients, PushSender } from './push-sender';

// Lo más que admite FCM en un envío a varios dispositivos
const MAX_RECIPIENTS_PER_REQUEST = 500;
// Errores de FCM de un token o un FID que ya no sirve: se borra
const INVALID_RECIPIENT_CODES: ReadonlySet<string> = new Set([
  'messaging/registration-token-not-registered',
  'messaging/installation-id-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);
// Canal de Android de los avisos (lo crea la app): viajes y mensajes
export const ANDROID_CHANNEL_ID = 'trips';

type Content = Omit<Parameters<Messaging['send']>[0], 'token' | 'fid'>;

// Envío real con Firebase Cloud Messaging, a la web (por FID) y a la app
// Android (por token). La cuenta de servicio se lee al arrancar desde su JSON
// (fuera del repositorio)
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
    { tokens, fids }: PushRecipients,
    message: PushMessage,
  ): Promise<string[]> {
    const content: Content = {
      notification: { title: message.title, body: message.body },
      data: message.data,
      android: { notification: { channelId: ANDROID_CHANNEL_ID } },
    };
    // Los lotes van a la vez (son independientes)
    const invalidByBatch = await Promise.all([
      ...toBatches(fids).map(async (batch) =>
        invalidOf(
          batch,
          await this.messaging.sendEach(
            batch.map((fid) => ({ ...content, fid })),
          ),
        ),
      ),
      ...toBatches(tokens).map(async (batch) =>
        invalidOf(
          batch,
          // Por token, solo la app Android: su plugin aún no da FID
          await this.messaging.sendEach(
            batch.map((token) => ({ ...content, token })),
          ),
        ),
      ),
    ]);
    return invalidByBatch.flat();
  }
}

// Los de un lote que FCM ya no acepta (la respuesta va en el mismo orden)
function invalidOf(batch: string[], { responses }: BatchResponse): string[] {
  return batch.filter((_, index) => {
    const { success, error } = responses[index];
    return !success && !!error && INVALID_RECIPIENT_CODES.has(error.code);
  });
}

// En lotes de MAX_RECIPIENTS_PER_REQUEST
function toBatches(ids: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += MAX_RECIPIENTS_PER_REQUEST) {
    batches.push(ids.slice(start, start + MAX_RECIPIENTS_PER_REQUEST));
  }
  return batches;
}
