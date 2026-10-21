import { ApiProperty } from '@nestjs/swagger';
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
// reglas de negocio (dominio UAL, correo repetido) están en AuthService.
// @ApiProperty lo describe en OpenAPI (Swagger)
export class RegisterDto {
  @ApiProperty({ maxLength: 100, example: 'Ana García' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description:
      'Only emails from the allowed domains (ual.es, inlumine.ual.es)',
    maxLength: 254,
    example: 'ana@ual.es',
  })
  @IsEmail()
  @MaxLength(254)
  email!: string;

  // bcrypt solo usa los 72 primeros bytes: más largo daría una falsa sensación
  // de seguridad
  @ApiProperty({ minLength: 8, maxLength: 72, example: 'secret-password' })
  @IsString()
  @Length(8, 72)
  password!: string;

  @ApiProperty({
    enum: [...REGISTRABLE_PROFILES],
    isArray: true,
    description: 'At least one; the admin profile cannot be requested',
    example: ['driver', 'passenger'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsIn(REGISTRABLE_PROFILES, { each: true })
  profiles!: RegistrableProfile[];
}
