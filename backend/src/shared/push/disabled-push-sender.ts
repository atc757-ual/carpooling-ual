import { PushSender } from './push-sender';

// Sin cuenta de servicio de Firebase: no envía nada (los avisos siguen dentro
// de la app)
export class DisabledPushSender extends PushSender {
  send(): Promise<string[]> {
    return Promise.resolve([]);
  }
}
