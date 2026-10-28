import { ApiProperty, PartialType, PickType } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { RegisterDto } from '../../auth/dto/register.dto';

// Tolerancias horarias que se pueden elegir, en minutos: las mismas que el
// margen de la búsqueda (± 5, 10, 15 o 20 min)
export const TIME_TOLERANCES_MIN = [5, 10, 15, 20] as const;

// Cuerpo de PATCH /api/users/me: lo que el usuario puede cambiar de su cuenta.
// El nombre y el teléfono con las mismas reglas que al registrarse; el correo
// no se cambia (es la identidad verificada de la UAL)
export class UpdateMeDto extends PartialType(
  PickType(RegisterDto, ['name', 'phone'] as const),
) {
  @ApiProperty({
    required: false,
    enum: TIME_TOLERANCES_MIN,
    description:
      'Default time margin of my searches, in minutes (± around the time)',
    example: 15,
  })
  @IsOptional()
  @IsIn(TIME_TOLERANCES_MIN)
  timeToleranceMin?: number;
}
