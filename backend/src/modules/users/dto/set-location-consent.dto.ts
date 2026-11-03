import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { CONSENT_ACTIONS, LOCATION_CONSENT_SOURCES } from '../user-consent';
import type { ConsentAction, LocationConsentSource } from '../user-consent';

// Cuerpo de PUT /api/users/me/consents/location: conceder o retirar el
// consentimiento de ubicación desde la app, desde dónde (settings si no se
// indica) y, al concederlo, la versión de su documento que se leyó
export class SetLocationConsentDto {
  @ApiProperty({ enum: CONSENT_ACTIONS, example: 'granted' })
  @IsIn(CONSENT_ACTIONS)
  action!: ConsentAction;

  @ApiProperty({
    enum: LOCATION_CONSENT_SOURCES,
    required: false,
    default: 'settings',
    description:
      'Where it was recorded: settings (the profile switch), location_prompt (the window explaining why location is used) or device (the app detected the system permission was removed)',
  })
  @IsOptional()
  @IsIn(LOCATION_CONSENT_SOURCES)
  source?: LocationConsentSource;

  @ApiProperty({
    required: false,
    example: '1.0',
    description:
      'When granting, the version of the location document that was read (the current one if omitted)',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+$/)
  version?: string;
}
