import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { LOGIN_PATH, RETURN_URL_PARAM } from './redirect-paths';

// Rutas que exigen sesión: sin ella, al login, recordando la página pedida
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isLoggedIn()) {
    return true;
  }
  return inject(Router).createUrlTree([LOGIN_PATH], { queryParams: { [RETURN_URL_PARAM]: state.url } });
};
