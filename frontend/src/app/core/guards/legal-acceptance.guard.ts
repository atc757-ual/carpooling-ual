import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { LegalDocumentsService } from '../services/users/legal-documents.service';
import { LEGAL_UPDATE_PATH, RETURN_URL_PARAM } from './redirect-paths';

// Al entrar en la app o en el panel con sesión: si se ha publicado una versión
// nueva de las condiciones o de la política que aún no ha aceptado, primero
// la pantalla para aceptarla (recordando adónde iba). Sin sesión decide el
// authGuard; si no se puede comprobar (p. ej. sin conexión), deja pasar
export const legalAcceptanceGuard: CanActivateFn = async (_route, state) => {
  if (!inject(AuthService).isLoggedIn()) {
    return true;
  }
  const router = inject(Router);
  try {
    const pending = await inject(LegalDocumentsService).pending();
    return pending.length === 0
      ? true
      : router.createUrlTree([LEGAL_UPDATE_PATH], {
          queryParams: { [RETURN_URL_PARAM]: state.url },
        });
  } catch {
    return true;
  }
};
