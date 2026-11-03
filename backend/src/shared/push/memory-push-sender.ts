import { PushMessage, PushSender } from './push-sender';

export interface SentPush {
  tokens: readonly string[];
  message: PushMessage;
}

// Para los tests: guarda lo enviado y trata como caducados los tokens que se
// le indiquen (invalidTokens)
export class MemoryPushSender extends PushSender {
  readonly sent: SentPush[] = [];
  readonly invalidTokens = new Set<string>();

  send(tokens: readonly string[], message: PushMessage): Promise<string[]> {
    this.sent.push({ tokens, message });
    return Promise.resolve(
      tokens.filter((token) => this.invalidTokens.has(token)),
    );
  }

  clear(): void {
    this.sent.length = 0;
    this.invalidTokens.clear();
  }
}
