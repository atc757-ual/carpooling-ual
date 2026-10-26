import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LOGIN_PATH, RETURN_URL_PARAM } from '../guards/redirect-paths';
import { ApiError } from '../models/api-error.model';
import { AuthService } from '../services/auth/auth.service';

// Rutas de /api/auth que no llevan token (las demás, incluida /auth/me, sí)
const PUBLIC_AUTH_PATHS = [
  '/auth/register',
  '/auth/verify-email',
  '/auth/verify-email/resend',
  '/auth/login',
  '/auth/refresh',
  '/auth/logout',
  '/auth/password-reset',
  '/auth/password-reset/verify',
  '/auth/password-reset/confirm',
];

function needsToken(request: HttpRequest<unknown>): boolean {
  const { apiUrl } = environment;
  return request.url.startsWith(apiUrl) && !PUBLIC_AUTH_PATHS.some((path) => request.url === apiUrl + path);
}

function withToken(request: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;
}

function isExpiredToken(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 401 && error.error?.code === 'ACCESS_TOKEN_EXPIRED';
}

// Añade el token de acceso a las peticiones a la API. Si ha caducado, lo
// renueva y repite la petición una sola vez. Si la sesión ya no se puede
// renovar, lleva al login (volviendo después a la página en la que estaba).
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!needsToken(request)) {
    return next(request);
  }
  const auth = inject(AuthService);
  const router = inject(Router);

  return next(withToken(request, auth.getAccessToken())).pipe(
    catchError((error: unknown) => {
      if (!isExpiredToken(error)) {
        return throwError(() => error);
      }
      return from(auth.refreshAccessToken()).pipe(
        catchError((refreshError: unknown) => {
          if (refreshError instanceof ApiError && refreshError.code === 'INVALID_REFRESH_TOKEN') {
            void router.navigate([LOGIN_PATH], { queryParams: { [RETURN_URL_PARAM]: router.url } });
          }
          return throwError(() => refreshError);
        }),
        switchMap((token) => next(withToken(request, token))),
      );
    }),
  );
};
