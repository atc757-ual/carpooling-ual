import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { Avatar } from '../entities/avatar.entity';

// Recurso TMF630 Avatar: un elemento del catálogo de avatares. Los de la
// plataforma son SVG (svg); los subidos por el panel, una imagen (imageHref)
export class AvatarResource {
  @ApiProperty({ enum: ['Avatar'] })
  '@type': 'Avatar';

  @ApiProperty({ example: 'sun' })
  id: string;

  @ApiProperty({ example: '/api/avatars/sun' })
  href: string;

  @ApiProperty({ example: 'Sol de Almería' })
  name: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Neutral SVG illustration compatible with light and dark mode; null for an uploaded image',
    example:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">...</svg>',
  })
  svg: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Link to the uploaded PNG or WebP image; null for an SVG',
    example: '/api/avatars/owl-photo/image',
  })
  imageHref: string | null;
}

// En el panel: también si se ofrece y su orden
export class AdminAvatarResource extends AvatarResource {
  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 3 })
  sortOrder: number;
}

export function avatarHref(key: string): string {
  return `/${API_PREFIX}/avatars/${key}`;
}

export function toAvatarResource(avatar: Avatar): AvatarResource {
  const href = avatarHref(avatar.key);
  return {
    '@type': 'Avatar',
    id: avatar.key,
    href,
    name: avatar.name,
    svg: avatar.svg,
    imageHref: avatar.contentType === null ? null : `${href}/image`,
  };
}

export function toAdminAvatarResource(avatar: Avatar): AdminAvatarResource {
  return {
    ...toAvatarResource(avatar),
    isActive: avatar.isActive,
    sortOrder: avatar.sortOrder,
  };
}
