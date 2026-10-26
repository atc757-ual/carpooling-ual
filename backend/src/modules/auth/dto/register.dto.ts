import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEmail,
  IsNotEmpty,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';

// Nombre de persona: letras de cualquier idioma (con tildes, ñ, ç…) y, entre
// ellas, un espacio, un guion o un apóstrofo (Ana-María, O'Connor). Sin
// números ni otros símbolos. Las tildes escritas aparte se unen a su letra
// antes (normalize('NFC') en el @Transform del nombre)
export const PERSON_NAME_PATTERN = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

// Cuerpo de POST /api/auth/register. Solo valida la FORMA de los datos; las
// reglas de negocio (dominio UAL, correo repetido) están en AuthService.
// Los perfiles (conductor, pasajero) no se piden aquí: el usuario los elige
// después de verificar el correo (PUT /api/users/me/profiles/{profile}).
// @ApiProperty lo describe en OpenAPI (Swagger)
export class RegisterDto {
  // Sin espacios en los extremos y uno solo entre palabras (PERSON_NAME_PATTERN)
  @ApiProperty({
    description: 'Letters, with a space, hyphen or apostrophe between them',
    maxLength: 100,
    example: 'Ana García',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value.normalize('NFC').trim().replace(/\s+/g, ' ')
      : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Matches(PERSON_NAME_PATTERN, {
    message:
      'name must contain only letters, with a space, hyphen or apostrophe between them',
  })
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

  // Formato internacional (con prefijo de país) para admitir también números
  // extranjeros (Erasmus). Se quitan espacios, guiones y paréntesis, así que
  // "+34 600 12 34 56" se guarda como +34600123456 (E.164)
  @ApiProperty({
    description:
      'International format with country code; spaces, dashes and ' +
      'parentheses are ignored',
    maxLength: 16,
    example: '+34600123456',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s\-()]/g, '') : value,
  )
  @IsString()
  @MaxLength(16)
  @IsPhoneNumber()
  phone!: string;

  // Tiene que aceptar las normas y la política de privacidad para registrarse;
  // se guarda la fecha como prueba del consentimiento (RGPD)
  @ApiProperty({
    description: 'Acceptance of the community rules and privacy policy',
    enum: [true],
    example: true,
  })
  @Equals(true)
  acceptedTerms!: true;
}
