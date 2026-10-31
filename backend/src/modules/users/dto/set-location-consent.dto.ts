import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { CONSENT_ACTIONS } from '../user-consent';
import type { ConsentAction } from '../user-consent';

// Cuerpo de PUT /api/users/me/consents/location: conceder o retirar el
// consentimiento de ubicación desde la app
export class SetLocationConsentDto {
  @ApiProperty({ enum: CONSENT_ACTIONS, example: 'granted' })
  @IsIn(CONSENT_ACTIONS)
  action!: ConsentAction;
}
