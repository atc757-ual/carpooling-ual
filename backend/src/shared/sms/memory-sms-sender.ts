import { SmsMessage, SmsSender } from './sms-sender';

// Bandeja de SMS en memoria para los tests: los mensajes no salen de la
// aplicación y los tests pueden leer el último código enviado a un número
export class MemorySmsSender extends SmsSender {
  private readonly messages: SmsMessage[] = [];

  send(message: SmsMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  sentTo(phone: string): SmsMessage[] {
    return this.messages.filter(({ to }) => to === phone);
  }

  lastSentTo(phone: string): SmsMessage | undefined {
    return this.sentTo(phone).at(-1);
  }
}
