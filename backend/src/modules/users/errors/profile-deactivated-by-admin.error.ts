import { BusinessError } from '../../../shared/errors/business-error';
import type { ProfileType } from '../profile-type';

// El usuario intenta activar un perfil que un administrador le desactivó
// (RF-25): solo un administrador puede reactivarlo. La capa API lo traduce a
// un 409 (PROFILE_DEACTIVATED_BY_ADMIN)
export class ProfileDeactivatedByAdminError extends BusinessError {
  constructor(profile: ProfileType) {
    super(
      'PROFILE_DEACTIVATED_BY_ADMIN',
      'conflict',
      `The ${profile} profile was deactivated by an administrator`,
    );
  }
}
