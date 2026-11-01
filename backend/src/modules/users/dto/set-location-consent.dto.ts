import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { CONSENT_ACTIONS, LOCATION_CONSENT_SOURCES } from '../user-consent';
import type { ConsentAction, LocationConsentSource } from '../user-consent';

// Cuerpo de PUT /api/users/me/consents/location: conceder o retirar el
// consentimiento de ubicación desde la app, y desde dónde (settings si no se
// indica)
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
}
