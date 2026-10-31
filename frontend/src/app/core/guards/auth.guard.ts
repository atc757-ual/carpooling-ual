import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import {
  HOME_PATH,
  LOGIN_PATH,
  PUBLISH_PATH,
  RETURN_URL_PARAM,
  SEARCH_PATH,
  WELCOME_PATH,
} from './redirect-paths';

// Las entradas a la app: /tabs (la redirección a Publicar se aplica antes del
// guard, que ya recibe /tabs/publish) y las pestañas principales
const ENTRY_PATHS: ReadonlySet<string> = new Set([HOME_PATH, PUBLISH_PATH, SEARCH_PATH]);

// Rutas que exigen sesión: sin ella, al login, recordando la página pedida. Al
// abrir la app sin sesión, a la bienvenida
export const authGuard: CanActivateFn = (_route, state) => {
  if (inject(AuthService).isLoggedIn()) {
    return true;
  }
  const router = inject(Router);
  if (ENTRY_PATHS.has(state.url)) {
    return router.createUrlTree([WELCOME_PATH]);
  }
  return router.createUrlTree([LOGIN_PATH], { queryParams: { [RETURN_URL_PARAM]: state.url } });
};
