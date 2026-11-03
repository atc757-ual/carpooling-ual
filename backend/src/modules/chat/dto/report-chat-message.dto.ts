import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

// Cuerpo de POST /api/trips/{id}/messages/{messageId}/report: por qué se
// denuncia (como las incidencias, al menos 10 caracteres)
export class ReportChatMessageDto {
  @ApiProperty({
    minLength: 10,
    maxLength: 500,
    example: 'Insults and threats',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(10, 500)
  reason!: string;
}
