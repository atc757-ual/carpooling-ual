import { BusinessError } from '../../../shared/errors/business-error';

// Esa opción de la preferencia ya no se ofrece (la desactivó el panel). La
// capa API lo traduce a un 400 (TRAVEL_PREFERENCE_NOT_OFFERED)
export class TravelPreferenceNotOfferedError extends BusinessError {
  constructor(
    readonly preference: string,
    readonly value: string,
  ) {
    super(
      'TRAVEL_PREFERENCE_NOT_OFFERED',
      'invalid',
      `The option ${value} of ${preference} is not offered`,
    );
  }
}
