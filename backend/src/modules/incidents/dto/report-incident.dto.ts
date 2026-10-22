import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, Length } from 'class-validator';
import { INCIDENT_CATEGORIES } from '../entities/incident.entity';
import type { IncidentCategory } from '../entities/incident.entity';

// Cuerpo de POST /api/trips/{tripId}/incidents (RF-23). La descripción obliga
// a explicar algo (mínimo 10 caracteres) sin admitir textos enormes
export class ReportIncidentDto {
  @ApiProperty({
    enum: INCIDENT_CATEGORIES,
    description:
      'technical problem, with the driver, with the passenger or other',
  })
  @IsIn(INCIDENT_CATEGORIES)
  category!: IncidentCategory;

  @ApiProperty({
    minLength: 10,
    maxLength: 1000,
    example: 'The car broke down on the way to the campus',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 1000)
  description!: string;
}
