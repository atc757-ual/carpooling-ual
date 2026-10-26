import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { ResendVerificationCodeDto, VerifyEmailDto } from './verify-email.dto';

// Cuerpo de POST /api/auth/password-reset: el correo, como en el reenvío del
// código de verificación
export class RequestPasswordResetDto extends ResendVerificationCodeDto {}

// Cuerpo de POST /api/auth/password-reset/verify: correo y código
export class CheckPasswordResetCodeDto extends VerifyEmailDto {}

// Cuerpo de POST /api/auth/password-reset/confirm: correo, código y la
// contraseña nueva, con las mismas reglas que en el registro
export class ResetPasswordDto extends VerifyEmailDto {
  // bcrypt solo usa los 72 primeros bytes
  @ApiProperty({ minLength: 8, maxLength: 72, example: 'new-secret-password' })
  @IsString()
  @Length(8, 72)
  password!: string;
}
