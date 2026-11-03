import { BusinessError } from '../../../shared/errors/business-error';

// No se puede denunciar un mensaje propio. La capa API lo traduce a un 409
// (CHAT_OWN_MESSAGE)
export class ChatOwnMessageError extends BusinessError {
  constructor(readonly messageId: string) {
    super('CHAT_OWN_MESSAGE', 'conflict', `Message ${messageId} is your own`);
  }
}
