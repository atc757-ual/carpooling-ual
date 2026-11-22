import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { APP_LANGUAGES } from '../../../shared/i18n/app-language';
import type { AppLanguage } from '../../../shared/i18n/app-language';
import {
  PUSH_PLATFORMS,
  type PushPlatform,
} from '../entities/push-token.entity';

// Cuerpo de PUT /api/users/me/push-tokens: el token que da Firebase en el
// dispositivo o navegador y dónde está
export class RegisterPushTokenDto {
  @ApiProperty({
    description:
      'The Firebase installation id (FID) on the web, or the Firebase Cloud Messaging registration token in the Android app',
    maxLength: 4096,
  })
  @IsString()
  @Length(1, 4096)
  token!: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  @IsIn(PUSH_PLATFORMS)
  platform!: PushPlatform;

  // La app lo vuelve a registrar al cambiar de idioma
  @ApiProperty({
    required: false,
    enum: APP_LANGUAGES,
    description:
      'Language of the push notifications on this device (es by default)',
    example: 'en',
  })
  @IsOptional()
  @IsIn(APP_LANGUAGES)
  language?: AppLanguage;
}
