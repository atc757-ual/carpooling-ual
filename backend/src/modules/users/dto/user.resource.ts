import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import {
  ProfileType,
  REGISTRABLE_PROFILES,
  RegistrableProfile,
} from '../profile-type';
import { AVATAR_KEYS, type AvatarKey } from '../travel-preferences';
import { UserSummary } from '../user-summary';
import { TravelPreferencesResource } from './travel-preferences.resource';

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
    description:
      'Whether the current phone number has been verified by SMS (false if unverified or if the user has no phone)',
    example: false,
  })
  phoneVerified: boolean;

  @ApiProperty({
    enum: ['driver', 'passenger', 'admin'],
    isArray: true,
    example: ['driver', 'passenger'],
  })
  profiles: ProfileType[];

  @ApiProperty({
    enum: REGISTRABLE_PROFILES,
    nullable: true,
    description:
      'The mode the user travels with now, the same on every device; null until chosen',
    example: 'passenger',
  })
  activeMode: RegistrableProfile | null;

  @ApiProperty({
    description:
      'Default time margin of my searches, in minutes (± around the time)',
    example: 15,
  })
  timeToleranceMin: number;

  @ApiProperty({
    enum: AVATAR_KEYS,
    nullable: true,
    description:
      'Chosen avatar from the platform catalogue; null shows initials',
    example: 'sun',
  })
  avatarKey: AvatarKey | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Public "About me" (20–500 characters when filled); null if empty',
    example:
      'Conductora habitual desde Roquetas de Mar al campus de La Cañada.',
  })
  bio: string | null;

  @ApiProperty({ type: TravelPreferencesResource })
  preferences: TravelPreferencesResource;
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
    phoneVerified: user.phoneVerified,
    profiles: user.profiles,
    activeMode: user.activeMode,
    timeToleranceMin: user.timeToleranceMin,
    avatarKey: user.avatarKey,
    bio: user.bio,
    preferences: user.preferences,
  };
}
