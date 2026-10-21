import { ProfileType } from '../../users/profile-type';
import { AuthenticatedUser, LoginResult } from '../auth.service';

// Recursos TMF630 que devuelve la API de auth, cada uno con su @type. User aún
// no lleva href (enlace al propio recurso) porque GET /api/users/{id} no
// existe todavía: se añadirá junto con ese endpoint
export interface UserResource {
  '@type': 'User';
  id: string;
  name: string;
  email: string;
  profiles: ProfileType[];
}

export interface AccessTokenResource {
  '@type': 'AccessToken';
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserResource;
}

export function toUserResource(user: AuthenticatedUser): UserResource {
  return {
    '@type': 'User',
    id: user.id,
    name: user.name,
    email: user.email,
    profiles: user.profiles,
  };
}

export function toAccessTokenResource(login: LoginResult): AccessTokenResource {
  return {
    '@type': 'AccessToken',
    accessToken: login.accessToken,
    tokenType: 'Bearer',
    expiresIn: login.expiresInSeconds,
    user: toUserResource(login.user),
  };
}
