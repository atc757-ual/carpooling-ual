import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ADMIN_PATH } from './redirect-paths';

// La app de conductor y pasajero (/tabs): el administrador que no tiene
// ninguno de esos perfiles no tiene nada que hacer en ella y va al panel. Va
// después de authGuard, así que aquí ya hay sesión
export const appAreaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const canUseApp = auth.hasProfile('driver') || auth.hasProfile('passenger');
  if (auth.hasProfile('admin') && !canUseApp) {
    return inject(Router).createUrlTree([ADMIN_PATH]);
  }
  return true;
};
