import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// Cuerpo de POST /api/auth/login. No aplica las reglas de longitud de la
// contraseña: si no coincide, el login falla igualmente con INVALID_CREDENTIALS
export class LoginDto {
  @ApiProperty({ example: 'lucia@ual.es' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'carpooling' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
