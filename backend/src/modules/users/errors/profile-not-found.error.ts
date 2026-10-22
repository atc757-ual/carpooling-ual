import { BusinessError } from '../../../shared/errors/business-error';
import type { ProfileType } from '../profile-type';

// El usuario nunca ha tenido ese perfil. El administrador solo activa o
// desactiva perfiles existentes (salvo el de administrador, que asigna): crear
// el de conductor o pasajero es decisión del propio usuario. La capa API lo
// traduce a un 404 (PROFILE_NOT_FOUND)
export class ProfileNotFoundError extends BusinessError {
  constructor(
    readonly userId: string,
    readonly profile: ProfileType,
  ) {
    super(
      'PROFILE_NOT_FOUND',
      'not_found',
      `The user ${userId} has no ${profile} profile`,
    );
  }
}
