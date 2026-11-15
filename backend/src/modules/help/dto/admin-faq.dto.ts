import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';
import { FAQ_AUDIENCES, FAQ_CONTEXTS, FAQ_STATUSES } from '../faq-values';
import type { FaqAudience, FaqContext, FaqStatus } from '../faq-values';

const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;
const trimEach = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value)
    ? value.map((point: unknown) =>
        typeof point === 'string' ? point.trim() : point,
      )
    : value;

export const TOPIC_KEY = /^[a-z0-9-]{1,40}$/;
const MAX_QUESTION = 160;
const MAX_ANSWER = 2000;
const MAX_POINTS = 8;
const MAX_POINT = 300;
export const MOVE_DIRECTIONS = ['up', 'down'] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

// La lista opcional de puntos de una respuesta, igual en los dos idiomas
function FaqPoints(): PropertyDecorator {
  return applyDecorators(
    ApiPropertyOptional({ type: [String], maxItems: MAX_POINTS }),
    Transform(trimEach),
    IsOptional(),
    IsArray(),
    ArrayMaxSize(MAX_POINTS),
    IsString({ each: true }),
    IsNotEmpty({ each: true }),
    MaxLength(MAX_POINT, { each: true }),
  );
}

// Filtros de la lista del panel (además de ?offset=&limit=)
export class AdminFaqQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'cancellations', description: 'Topic key' })
  @IsOptional()
  @Matches(TOPIC_KEY)
  topic?: string;

  @ApiPropertyOptional({ enum: FAQ_STATUSES })
  @IsOptional()
  @IsIn(FAQ_STATUSES)
  status?: FaqStatus;

  @ApiPropertyOptional({
    minLength: 2,
    maxLength: 60,
    description:
      'Text to look for in both languages, ignoring case and accents',
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  q?: string;
}

// Una pregunta nueva: siempre nace como borrador, al final de su tema. El
// inglés puede quedar vacío hasta publicarla
export class CreateFaqDto {
  @ApiProperty({ example: 'cancellations', description: 'Topic key' })
  @Matches(TOPIC_KEY)
  topic: string;

  @ApiProperty({ enum: FAQ_AUDIENCES })
  @IsIn(FAQ_AUDIENCES)
  audience: FaqAudience;

  @ApiPropertyOptional({
    enum: FAQ_CONTEXTS,
    isArray: true,
    description: 'Screens that show it as a quick question',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(FAQ_CONTEXTS, { each: true })
  quickContexts?: FaqContext[];

  @ApiProperty({
    example: '¿Puedo cancelar mi plaza?',
    maxLength: MAX_QUESTION,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_QUESTION)
  questionEs: string;

  @ApiPropertyOptional({
    example: 'Can I cancel my seat?',
    maxLength: MAX_QUESTION,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUESTION)
  questionEn?: string;

  @ApiProperty({ example: 'Sí, desde Tus viajes.', maxLength: MAX_ANSWER })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_ANSWER)
  answerEs: string;

  @ApiPropertyOptional({
    example: 'Yes, from Your trips.',
    maxLength: MAX_ANSWER,
  })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(MAX_ANSWER)
  answerEn?: string;

  @FaqPoints()
  pointsEs?: string[];

  @FaqPoints()
  pointsEn?: string[];
}

// Solo cambia lo que se envía. El estado y el orden tienen sus rutas
export class UpdateFaqDto extends PartialType(CreateFaqDto) {}

export class MoveFaqDto {
  @ApiProperty({ enum: MOVE_DIRECTIONS })
  @IsIn(MOVE_DIRECTIONS)
  direction: MoveDirection;
}

// Lo que el panel cambia de un tema: sus nombres y su icono (la clave no)
export class UpdateFaqTopicDto {
  @ApiPropertyOptional({ example: 'Cancelaciones', maxLength: 60 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nameEs?: string;

  @ApiPropertyOptional({ example: 'Cancellations', maxLength: 60 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nameEn?: string;

  @ApiPropertyOptional({
    example: 'close-circle-outline',
    description: 'Ionicons name',
  })
  @IsOptional()
  @Matches(/^[a-z0-9-]{1,40}$/)
  icon?: string;
}
