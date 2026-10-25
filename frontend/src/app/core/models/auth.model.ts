// Peticiones y respuestas de /api/auth (ver docs/api/openapi.json)
import { Profile, User } from './user.model';

// Perfiles que elige el propio usuario después de registrarse (su modo); el de
// administrador solo lo asigna otro administrador
export type RegisterProfile = Exclude<Profile, 'admin'>;

// El registro no lleva perfiles: se eligen después de verificar el correo
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  // Formato internacional, p. ej. +34600123456
  phone: string;
  // Aceptación de las normas y la política de privacidad (obligatoria)
  acceptedTerms: true;
}

// El código de 6 cifras que se envía al correo al registrarse
export interface VerifyEmailRequest {
  email: string;
  code: string;
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
