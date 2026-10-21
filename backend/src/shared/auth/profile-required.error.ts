import { BusinessError } from '../errors/business-error';
import type { ProfileType } from '../../modules/users/profile-type';

// El usuario está autenticado pero no tiene el perfil que exige la acción
// (RNF-04). 403 (PROFILE_REQUIRED): "sé quién eres, pero no puedes hacer esto"
export class ProfileRequiredError extends BusinessError {
  constructor(readonly requiredProfiles: ProfileType[]) {
    super(
      'PROFILE_REQUIRED',
      'forbidden',
      `This action requires one of the profiles: ${requiredProfiles.join(', ')}`,
    );
  }
}
