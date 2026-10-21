import { SetMetadata } from '@nestjs/common';
import type { ProfileType } from '../../modules/users/profile-type';

export const PROFILES_KEY = 'profiles';

// Perfiles que exige una ruta (RNF-04): basta con tener UNO de ellos.
//   @Profiles('admin')               → solo administradores
//   @Profiles('driver', 'passenger') → conductores o pasajeros
// Sin @Profiles, cualquier usuario autenticado puede usar la ruta
export const Profiles = (
  ...profiles: ProfileType[]
): MethodDecorator & ClassDecorator => SetMetadata(PROFILES_KEY, profiles);
