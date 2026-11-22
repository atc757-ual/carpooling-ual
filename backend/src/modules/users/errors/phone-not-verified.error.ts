import { BusinessError } from '../../../shared/errors/business-error';

// Compartir el teléfono en los viajes pide tenerlo verificado (con el código
// del SMS): así quien llama sabe que el número es de esa persona
export class PhoneNotVerifiedError extends BusinessError {
  constructor() {
    super(
      'PHONE_NOT_VERIFIED',
      'conflict',
      'Verify your phone number before sharing it on your trips',
    );
  }
}
