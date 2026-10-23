// Peticiones y respuestas de /api/auth (ver docs/api/openapi.json)
import { Profile, User } from './user.model';

// El perfil de administrador no se puede pedir al registrarse
export type RegisterProfile = Exclude<Profile, 'admin'>;

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  profiles: RegisterProfile[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

// Respuesta de login y de refresh. El token de acceso dura 15 minutos; el de
// renovación es de un solo uso (cada renovación devuelve uno nuevo)
export interface AccessToken {
  '@type': 'AccessToken';
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: User;
}
