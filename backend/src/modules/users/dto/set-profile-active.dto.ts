import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length } from 'class-validator';

// Cuerpo de PUT /api/users/{id}/profiles/{profile} (RF-25). Para el perfil de
// administrador, true lo asigna y false lo retira
export class SetProfileActiveDto {
  @ApiProperty({
    description:
      'Activate or deactivate the profile. For the admin profile, true assigns it and false removes it',
  })
  @IsBoolean()
  isActive!: boolean;

  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    example: 'Several reports of unsafe driving on the same week',
    description: 'Why the admin makes the change (audit)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  reason!: string;
}
