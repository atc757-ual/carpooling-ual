import { BusinessError } from '../../../shared/errors/business-error';

// No existe un avatar activo con esa clave. La capa API lo traduce a un 404
// (AVATAR_NOT_FOUND)
export class AvatarNotFoundError extends BusinessError {
  constructor(readonly avatarKey: string) {
    super(
      'AVATAR_NOT_FOUND',
      'not_found',
      `There is no active avatar with key ${avatarKey}`,
    );
  }
}

