import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Profile } from '../models/user.model';
import { AuthService } from '../services/auth/auth.service';
import { authGuard } from './auth.guard';
import { PROFILE_PATH } from './redirect-paths';

// Rutas que exigen alguno de los perfiles indicados (p. ej. publicar un viaje:
// profileGuard('driver')). Sin sesión, al login; sin el perfil, al Perfil
// (no a la entrada: podría volver aquí y no acabar nunca).
// El backend lo vuelve a comprobar (403 PROFILE_REQUIRED): esto solo evita
// mostrar pantallas que no se pueden usar.
export function profileGuard(...profiles: Profile[]): CanActivateFn {
  return (route, state) => {
    const auth = inject(AuthService);
    if (!auth.isLoggedIn()) {
      return authGuard(route, state);
    }
    return (
      profiles.some((profile) => auth.hasProfile(profile)) ||
      inject(Router).createUrlTree([PROFILE_PATH])
    );
  };
}
