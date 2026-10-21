import type { Request } from 'express';
import type { ProfileType } from '../../modules/users/profile-type';

// Contenido del token de acceso: sub (subject) es el estándar JWT para el id
// del usuario. Está en shared porque lo usan los controllers de todos los
// módulos (con @CurrentUser) y los guards
export interface AccessTokenPayload {
  sub: string;
  profiles: ProfileType[];
}

// Petición ya autenticada: el guard JWT deja en "user" el contenido del token
export interface AuthenticatedRequest extends Request {
  user: AccessTokenPayload;
}
