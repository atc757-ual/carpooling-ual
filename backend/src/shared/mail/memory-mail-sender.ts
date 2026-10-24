import { MailMessage, MailSender } from './mail-sender';

// Buzón en memoria para los tests: los correos no salen de la aplicación y
// los tests pueden leer el último que recibió una dirección (p. ej. para
// sacar el código de verificación, como haría el usuario)
export class MemoryMailSender extends MailSender {
  private readonly messages: MailMessage[] = [];

  send(message: MailMessage): Promise<void> {
    this.messages.push(message);
    return Promise.resolve();
  }

  // Correos recibidos por esa dirección, del más antiguo al más reciente
  sentTo(email: string): MailMessage[] {
    const address = email.toLowerCase();
    return this.messages.filter(({ to }) => to.toLowerCase() === address);
  }

  lastSentTo(email: string): MailMessage | undefined {
    return this.sentTo(email).at(-1);
  }
}
