import { BusinessError } from '../../../shared/errors/business-error';

// Solo hablan en el chat el conductor y los pasajeros aceptados del viaje. La
// capa API lo traduce a un 403 (CHAT_NOT_ALLOWED)
export class ChatNotAllowedError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'CHAT_NOT_ALLOWED',
      'forbidden',
      `You are not part of the chat of trip ${tripId}`,
    );
  }
}
