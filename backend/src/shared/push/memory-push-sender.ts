import { PushMessage, PushRecipients, PushSender } from './push-sender';

export interface SentPush {
  recipients: PushRecipients;
  message: PushMessage;
}

// Para los tests: guarda lo enviado y trata como caducados los tokens o FID
// que se le indiquen (invalidTokens)
export class MemoryPushSender extends PushSender {
  readonly sent: SentPush[] = [];
  readonly invalidTokens = new Set<string>();

  send(recipients: PushRecipients, message: PushMessage): Promise<string[]> {
    this.sent.push({ recipients, message });
    return Promise.resolve(
      [...recipients.tokens, ...recipients.fids].filter((id) =>
        this.invalidTokens.has(id),
      ),
    );
  }

  clear(): void {
    this.sent.length = 0;
    this.invalidTokens.clear();
  }
}
