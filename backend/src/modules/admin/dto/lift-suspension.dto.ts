import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Cuerpo de POST /api/admin/users/{id}/suspensions/{role}/lift
export class LiftSuspensionDto {
  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    example: 'The late cancellations were caused by a strike',
    description: 'Why the admin lifts the suspension (audit)',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  reason!: string;
}
