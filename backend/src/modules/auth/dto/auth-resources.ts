import { ApiProperty } from '@nestjs/swagger';
import { ProfileType } from '../../users/profile-type';
import { AuthenticatedUser, AuthSession } from '../auth.service';

// Recursos TMF630 que devuelve la API de auth, cada uno con su @type. User aún
// no lleva href (enlace al propio recurso) porque GET /api/users/{id} no
// existe todavía: se añadirá junto con ese endpoint.
// Son clases (y no interfaces) para que OpenAPI pueda describirlas
export class UserResource {
  @ApiProperty({ enum: ['User'] })
  '@type': 'User';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana García' })
  name: string;

  @ApiProperty({ example: 'ana@ual.es' })
  email: string;

  @ApiProperty({
    enum: ['driver', 'passenger', 'admin'],
    isArray: true,
    example: ['driver', 'passenger'],
  })
  profiles: ProfileType[];
}

export class AccessTokenResource {
  @ApiProperty({ enum: ['AccessToken'] })
  '@type': 'AccessToken';

  @ApiProperty({
    description: 'JWT to send as Authorization: Bearer <accessToken>',
  })
  accessToken: string;

  @ApiProperty({ enum: ['Bearer'] })
  tokenType: 'Bearer';

  @ApiProperty({
    description: 'Lifetime of the access token in seconds',
    example: 900,
  })
  expiresIn: number;

  // Se guarda en el cliente y solo se envía a /refresh y /logout
  @ApiProperty({
    description:
      'Send it only to /api/auth/refresh and /api/auth/logout. Single use: ' +
      'each refresh returns a new one',
    example: 'kX9_2LqZ3vH7mN1pR8sT4uW6yA0bC5dE7fG9hJ2kL4n',
  })
  refreshToken: string;

  @ApiProperty({
    format: 'date-time',
    description: 'The session can be renewed until this moment',
  })
  refreshTokenExpiresAt: string;

  @ApiProperty({ type: UserResource })
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

export function toAccessTokenResource(
  session: AuthSession,
): AccessTokenResource {
  return {
    '@type': 'AccessToken',
    accessToken: session.accessToken,
    tokenType: 'Bearer',
    expiresIn: session.expiresInSeconds,
    refreshToken: session.refreshToken,
    refreshTokenExpiresAt: session.refreshTokenExpiresAt.toISOString(),
    user: toUserResource(session.user),
  };
}
