import { BusinessError } from '../../../shared/errors/business-error';

// La imagen subida no sirve de avatar: no es PNG ni WebP, pesa demasiado o no
// es cuadrada del tamaño permitido. La capa API lo traduce a un 422
// (INVALID_AVATAR_IMAGE)
export class InvalidAvatarImageError extends BusinessError {
  constructor(readonly reason: string) {
    super(
      'INVALID_AVATAR_IMAGE',
      'unprocessable',
      `The avatar image is not valid: ${reason}`,
    );
  }
}
