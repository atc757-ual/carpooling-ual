import { BusinessError } from '../../../shared/errors/business-error';

// Con el viaje en curso, el conductor solo envía respuestas rápidas
// (seguridad vial). La capa API lo traduce a un 409 (CHAT_QUICK_REPLIES_ONLY)
export class ChatQuickRepliesOnlyError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'CHAT_QUICK_REPLIES_ONLY',
      'conflict',
      `The driver can only send quick replies while trip ${tripId} is in progress`,
    );
  }
}
