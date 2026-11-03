import { BusinessError } from '../../../shared/errors/business-error';

// El chat ya no admite mensajes: el viaje terminó hace más de 24 h, se
// canceló o aún no tiene pasajeros. La capa API lo traduce a un 409
// (CHAT_CLOSED)
export class ChatClosedError extends BusinessError {
  constructor(readonly tripId: string) {
    super('CHAT_CLOSED', 'conflict', `The chat of trip ${tripId} is closed`);
  }
}
