import { BusinessError } from '../../../shared/errors/business-error';

// Quien pide el perfil no comparte el viaje con esa persona como conductor y
// pasajero aceptado (403 PARTICIPANT_PROFILE_FORBIDDEN)
export class ParticipantProfileForbiddenError extends BusinessError {
  constructor(readonly tripId: string) {
    super(
      'PARTICIPANT_PROFILE_FORBIDDEN',
      'forbidden',
      `You can only see the driver or the accepted passengers of the trip ${tripId} you share with them`,
    );
  }
}
