import { BusinessError } from '../../../shared/errors/business-error';

// Demasiados mensajes seguidos (CHAT_MAX_MESSAGES_PER_MINUTE). La capa API lo
// traduce a un 429 (CHAT_RATE_LIMITED)
export class ChatRateLimitedError extends BusinessError {
  constructor(readonly limit: number) {
    super(
      'CHAT_RATE_LIMITED',
      'too_many_requests',
      `No more than ${limit} messages per minute`,
    );
  }
}
