import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export const MAX_SUGGESTIONS = 10;

// Parámetros de GET /api/places: el texto escrito y cuántas sugerencias
export class SearchPlacesQueryDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 120,
    description: 'Text of the address, as typed',
    example: 'avenida mediterraneo 120',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  q: string;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_SUGGESTIONS, default: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_SUGGESTIONS)
  limit: number = 5;
}

// Parámetros de GET /api/places/reverse: un punto (p. ej. la ubicación del
// dispositivo)
export class ReversePlaceQueryDto {
  @ApiProperty({ minimum: -180, maximum: 180, example: -2.4637 })
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon: number;

  @ApiProperty({ minimum: -90, maximum: 90, example: 36.8381 })
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat: number;
}
