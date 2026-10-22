import { ApiProperty } from '@nestjs/swagger';
import { PROFILE_TYPES } from '../profile-type';
import type { ProfileType } from '../profile-type';
import type { UserAdminView } from '../user-profiles.service';
import { userHref } from './user.resource';

export class ProfileStatusResource {
  @ApiProperty({ enum: PROFILE_TYPES })
  profile: ProfileType;

  @ApiProperty()
  isActive: boolean;
}

// Recurso TMF630 UserAdmin: lo que ve el administrador de un usuario (RF-25),
// con TODOS sus perfiles (activos o no). Es un tipo distinto de User para no
// cambiar lo que el resto de la API devuelve a los usuarios
export class UserAdminResource {
  @ApiProperty({ enum: ['UserAdmin'] })
  '@type': 'UserAdmin';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/users/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ example: 'Ana García' })
  name: string;

  @ApiProperty({ example: 'ana@ual.es' })
  email: string;

  @ApiProperty({ type: [ProfileStatusResource] })
  profiles: ProfileStatusResource[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

export function toUserAdminResource({
  user,
  profiles,
}: UserAdminView): UserAdminResource {
  return {
    '@type': 'UserAdmin',
    id: user.id,
    href: userHref(user.id),
    name: user.name,
    email: user.email,
    profiles,
    createdAt: user.createdAt.toISOString(),
  };
}
