import { inject } from '@angular/core';
import { CanDeactivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { WELCOME_PATH } from './redirect-paths';

// Al salir de «Elegir modo» sin haber elegido (la flecha o el atrás del
// navegador): se cierra la sesión y se va a la bienvenida. Si no, quedaría una
// sesión abierta sin modo, y las pantallas de acceso ya no se podrían abrir.
// Con el modo ya elegido, se sale sin más
export const leaveModesGuard: CanDeactivateFn<unknown> = async (
  _component,
  _currentRoute,
  _currentState,
  nextState,
) => {
  // inject() solo funciona antes del primer await
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn() || auth.hasProfile('passenger') || auth.hasProfile('driver')) {
    return true;
  }
  await auth.logout();
  return nextState.url === WELCOME_PATH || router.createUrlTree([WELCOME_PATH]);
};
