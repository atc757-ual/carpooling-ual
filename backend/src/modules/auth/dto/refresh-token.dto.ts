import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Cuerpo de POST /api/auth/refresh y POST /api/auth/logout. El token real
// mide 43 caracteres; el máximo solo evita cuerpos enormes
export class RefreshTokenDto {
  @ApiProperty({
    description: 'The refreshToken returned by login or by the last refresh',
    maxLength: 128,
    example: 'kX9_2LqZ3vH7mN1pR8sT4uW6yA0bC5dE7fG9hJ2kL4n',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  refreshToken!: string;
}
