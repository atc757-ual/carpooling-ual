import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

// Cuerpo de PUT /api/users/{id}/profiles/{profile} (RF-25). Para el perfil de
// administrador, true lo asigna y false lo retira
export class SetProfileActiveDto {
  @ApiProperty({
    description:
      'Activate or deactivate the profile. For the admin profile, true assigns it and false removes it',
  })
  @IsBoolean()
  isActive!: boolean;
}
