import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { FAQ_AUDIENCES, FAQ_CONTEXTS, FAQ_LANGS } from '../faq-values';
import type { FaqAudience, FaqContext, FaqLang } from '../faq-values';

// ?lang= de las lecturas de la ayuda: en qué idioma se devuelven los textos
export class FaqLangQueryDto {
  @ApiPropertyOptional({ enum: FAQ_LANGS, default: 'es' })
  @IsIn(FAQ_LANGS)
  lang: FaqLang = 'es';
}

// Filtros de la lista de preguntas (además de ?offset=&limit=)
export class FaqQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: FAQ_LANGS, default: 'es' })
  @IsIn(FAQ_LANGS)
  lang: FaqLang = 'es';

  @ApiPropertyOptional({
    enum: FAQ_CONTEXTS,
    description: 'Only the quick questions of that screen',
  })
  @IsOptional()
  @IsIn(FAQ_CONTEXTS)
  context?: FaqContext;

  @ApiPropertyOptional({
    enum: FAQ_AUDIENCES,
    description:
      'driver or passenger also return the questions for both; both returns only those',
  })
  @IsOptional()
  @IsIn(FAQ_AUDIENCES)
  audience?: FaqAudience;

  @ApiPropertyOptional({ example: 'cancellations', description: 'Topic key' })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  topic?: string;

  @ApiPropertyOptional({
    example: 'codigo',
    minLength: 2,
    maxLength: 60,
    description:
      'Text to look for in the question, the answer and its points, ignoring case and accents',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  q?: string;
}
