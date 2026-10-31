import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { Avatar } from '../entities/avatar.entity';
import { AVATAR_KEYS, type AvatarKey } from '../travel-preferences';

// Recurso TMF630 Avatar: un elemento del catálogo cerrado de avatares SVG
export class AvatarResource {
  @ApiProperty({ enum: ['Avatar'] })
  '@type': 'Avatar';

  @ApiProperty({ enum: AVATAR_KEYS, example: 'sun' })
  id: AvatarKey;

  @ApiProperty({ example: '/api/avatars/sun' })
  href: string;

  @ApiProperty({ example: 'Sol de Almería' })
  name: string;

  @ApiProperty({
    description: 'Neutral SVG illustration compatible with light and dark mode',
    example:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">...</svg>',
  })
  svg: string;
}

export function avatarHref(key: string): string {
  return `/${API_PREFIX}/avatars/${key}`;
}

export function toAvatarResource(avatar: Avatar): AvatarResource {
  return {
    '@type': 'Avatar',
    id: avatar.key,
    href: avatarHref(avatar.key),
    name: avatar.name,
    svg: avatar.svg,
  };
}
