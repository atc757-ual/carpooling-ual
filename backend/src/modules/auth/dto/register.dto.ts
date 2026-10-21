import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import {
  REGISTRABLE_PROFILES,
  type RegistrableProfile,
} from '../../users/profile-type';

// Cuerpo de POST /api/auth/register. Solo valida la FORMA de los datos; las
// reglas de negocio (dominio UAL, correo repetido) están en AuthService
export class RegisterDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  // bcrypt solo usa los 72 primeros bytes: más largo daría una falsa sensación
  // de seguridad
  @IsString()
  @Length(8, 72)
  password!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(REGISTRABLE_PROFILES, { each: true })
  profiles!: RegistrableProfile[];
}
