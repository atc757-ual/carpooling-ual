import { ApiProperty } from '@nestjs/swagger';
import { toUserResource, UserResource } from '../../users/dto/user.resource';
import { AuthSession } from '../auth.service';

// Recurso TMF630 AccessToken: lo devuelven el login y la renovación. El User
// que incluye es el recurso del módulo users.
// Es una clase (y no una interfaz) para que OpenAPI pueda describirla
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
