import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import {
  PUSH_PLATFORMS,
  type PushPlatform,
} from '../entities/push-token.entity';

// Cuerpo de PUT /api/users/me/push-tokens: el token que da Firebase en el
// dispositivo o navegador y dónde está
export class RegisterPushTokenDto {
  @ApiProperty({
    description: 'The Firebase Cloud Messaging registration token',
    maxLength: 4096,
  })
  @IsString()
  @Length(1, 4096)
  token!: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  @IsIn(PUSH_PLATFORMS)
  platform!: PushPlatform;
}
