import { BusinessError } from '../../../shared/errors/business-error';

// Código incorrecto, caducado, ya usado o de un correo que no existe: siempre
// el mismo error, para no dar pistas a quien intente adivinarlo. La capa API
// lo traduce a un 400 (INVALID_VERIFICATION_CODE)
export class InvalidVerificationCodeError extends BusinessError {
  constructor() {
    super(
      'INVALID_VERIFICATION_CODE',
      'invalid',
      'The verification code is not valid or has expired',
    );
  }
}
