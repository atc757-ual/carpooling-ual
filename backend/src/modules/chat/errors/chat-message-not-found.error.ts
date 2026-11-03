import { BusinessError } from '../../../shared/errors/business-error';

// No hay ningún mensaje con ese id en el chat de ese viaje. La capa API lo
// traduce a un 404 (CHAT_MESSAGE_NOT_FOUND)
export class ChatMessageNotFoundError extends BusinessError {
  constructor(readonly messageId: string) {
    super(
      'CHAT_MESSAGE_NOT_FOUND',
      'not_found',
      `There is no message ${messageId} in this chat`,
    );
  }
}
