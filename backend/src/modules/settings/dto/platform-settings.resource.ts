import { ApiProperty } from '@nestjs/swagger';
import type { PlatformSettings } from '../settings.service';

// Los ajustes que necesita la app (p. ej. si enseña «Publicar varios días»)
export class PlatformSettingsResource {
  @ApiProperty({ example: 'PlatformSettings' })
  '@type': string;

  @ApiProperty({ example: '/api/settings' })
  href: string;

  @ApiProperty({
    description: 'Drivers can publish the same trip on several days at once',
    example: false,
  })
  multiDayPublishing: boolean;
}

export class SettingsEditorResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Ana García' })
  name: string;
}

// Lo mismo para el panel, con el último cambio de cualquiera de ellos
export class AdminPlatformSettingsResource extends PlatformSettingsResource {
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Last change; null if never changed since installation',
  })
  updatedAt: string | null;

  @ApiProperty({
    type: SettingsEditorResource,
    nullable: true,
    description: 'Who made the last change; null if unknown or deleted',
  })
  updatedBy: SettingsEditorResource | null;
}

export function toPlatformSettingsResource(
  settings: PlatformSettings,
): PlatformSettingsResource {
  return {
    '@type': 'PlatformSettings',
    href: '/api/settings',
    multiDayPublishing: settings.multiDayPublishing,
  };
}

export function toAdminPlatformSettingsResource(
  settings: PlatformSettings,
  change: { updatedAt: Date | null; updatedBy: SettingsEditorResource | null },
): AdminPlatformSettingsResource {
  return {
    ...toPlatformSettingsResource(settings),
    href: '/api/admin/settings',
    updatedAt: change.updatedAt?.toISOString() ?? null,
    updatedBy: change.updatedBy,
  };
}
