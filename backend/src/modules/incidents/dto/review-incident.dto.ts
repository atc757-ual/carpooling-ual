import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Cuerpo de POST /api/incidents/{id}/review (CU-12): la resolución del
// administrador, con las mismas longitudes que la descripción
export class ReviewIncidentDto {
  @ApiProperty({
    minLength: 10,
    maxLength: 1000,
    example: 'The driver was contacted and the car was repaired',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 1000)
  resolution!: string;
}
