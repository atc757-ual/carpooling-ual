import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { ACCOUNT_DISABLED_PATH, HOME_PATH } from './redirect-paths';

// Una cuenta a la que un administrador ha desactivado todos sus perfiles no
// puede hacer nada en la app: va a la pantalla que se lo explica. Va después de
// authGuard. No es lo mismo que no tener perfiles aún (recién registrada)
export const accessRevokedGuard: CanActivateFn = () =>
  inject(AuthService).currentUser()?.isAccessRevoked
    ? inject(Router).createUrlTree([ACCOUNT_DISABLED_PATH])
    : true;

// Esa pantalla, solo para quien está en esa situación
export const accessRevokedOnlyGuard: CanActivateFn = () =>
  inject(AuthService).currentUser()?.isAccessRevoked === true ||
  inject(Router).createUrlTree([HOME_PATH]);
