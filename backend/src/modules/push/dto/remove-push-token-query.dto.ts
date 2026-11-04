import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

// Parámetro de DELETE /api/users/me/push-tokens: el token que se quita
export class RemovePushTokenQueryDto {
  @ApiProperty({ maxLength: 4096 })
  @IsString()
  @Length(1, 4096)
  token!: string;
}
