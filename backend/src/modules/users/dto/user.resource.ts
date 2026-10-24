import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { ProfileType } from '../profile-type';
import { UserSummary } from '../user-summary';

// Recurso TMF630 User: con @type, id y href (enlace al propio recurso,
// GET /api/users/{id}). Pertenece al módulo users; auth lo reutiliza en el
// registro y en /me. Es una clase para que OpenAPI pueda describirlo
export class UserResource {
  @ApiProperty({ enum: ['User'] })
  '@type': 'User';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/users/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ example: 'Ana García' })
  name: string;

  @ApiProperty({ example: 'ana@ual.es' })
  email: string;

  // Este recurso solo se devuelve al propio usuario (ver UserSummary)
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'International format (E.164); null if never registered',
    example: '+34600123456',
  })
  phone: string | null;

  @ApiProperty({
    enum: ['driver', 'passenger', 'admin'],
    isArray: true,
    example: ['driver', 'passenger'],
  })
  profiles: ProfileType[];
}

export function userHref(id: string): string {
  return `/${API_PREFIX}/users/${id}`;
}

export function toUserResource(user: UserSummary): UserResource {
  return {
    '@type': 'User',
    id: user.id,
    href: userHref(user.id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    profiles: user.profiles,
  };
}
