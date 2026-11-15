import { BusinessError } from '../../../shared/errors/business-error';

// El chat es directo entre el conductor y cada pasajero aceptado: el
// conductor indica con quién habla (passengerId) y tiene que ser un pasajero
// aceptado del viaje. La capa API lo traduce a un 400 (CHAT_PASSENGER_INVALID)
export class ChatPassengerInvalidError extends BusinessError {
  constructor(
    readonly tripId: string,
    readonly passengerId: string | undefined,
  ) {
    super(
      'CHAT_PASSENGER_INVALID',
      'invalid',
      passengerId
        ? `User ${passengerId} is not an accepted passenger of trip ${tripId}`
        : `Say which passenger of trip ${tripId} the conversation is with (passengerId)`,
    );
  }
}
