import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsString, Length } from 'class-validator';

// Cuerpo de PUT /api/users/{id}/account-access (RF-25): inhabilitar o
// rehabilitar la cuenta, con el motivo para la auditoría
export class SetAccountAccessDto {
  @ApiProperty({
    description:
      'true disables the account (the user cannot sign in until it is enabled again); false enables it',
  })
  @IsBoolean()
  isDisabled!: boolean;

  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    example: 'Repeated harassment reports confirmed by the support team',
    description: 'Why the admin makes the change (audit)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  reason!: string;
}
