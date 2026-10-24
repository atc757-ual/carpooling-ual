import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, Matches, MaxLength } from 'class-validator';

// Cuerpo de POST /api/auth/verify-email
export class VerifyEmailDto {
  @ApiProperty({ maxLength: 254, example: 'ana@ual.es' })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // Texto y no número: un código puede empezar por 0 (042137)
  @ApiProperty({
    description: 'The 6-digit code sent by email',
    pattern: '^[0-9]{6}$',
    example: '042137',
  })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

// Cuerpo de POST /api/auth/verify-email/resend
export class ResendVerificationCodeDto {
  @ApiProperty({ maxLength: 254, example: 'ana@ual.es' })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
