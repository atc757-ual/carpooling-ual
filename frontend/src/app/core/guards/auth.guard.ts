import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { HOME_PATH, LOGIN_PATH, RETURN_URL_PARAM, WELCOME_PATH } from './redirect-paths';

// Rutas que exigen sesión: sin ella, al login, recordando la página pedida. Al
// abrir la app (el inicio) sin sesión, a la bienvenida
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isLoggedIn()) {
    return true;
  }
  const router = inject(Router);
  if (state.url === HOME_PATH) {
    return router.createUrlTree([WELCOME_PATH]);
  }
  return router.createUrlTree([LOGIN_PATH], { queryParams: { [RETURN_URL_PARAM]: state.url } });
};
