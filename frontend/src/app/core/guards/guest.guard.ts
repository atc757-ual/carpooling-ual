import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { HOME_PATH } from './redirect-paths';

// Pantallas solo para quien no ha iniciado sesión (bienvenida, login,
// registro): con sesión, al inicio
export const guestGuard: CanActivateFn = () =>
  !inject(AuthService).isLoggedIn() || inject(Router).createUrlTree([HOME_PATH]);
