import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { REGISTRABLE_PROFILES } from '../profile-type';
import type { RegistrableProfile } from '../profile-type';

// Cuerpo de PUT /api/users/me/active-mode: el modo con el que viaja ahora
export class SetActiveModeDto {
  @ApiProperty({ enum: REGISTRABLE_PROFILES, example: 'driver' })
  @IsIn(REGISTRABLE_PROFILES)
  mode!: RegistrableProfile;
}
