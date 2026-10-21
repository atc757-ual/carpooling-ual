import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// Cuerpo de POST /api/auth/login. No aplica las reglas de longitud de la
// contraseña: si no coincide, el login falla igualmente con INVALID_CREDENTIALS
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
