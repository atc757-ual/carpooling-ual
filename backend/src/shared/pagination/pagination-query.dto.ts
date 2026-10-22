import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export const DEFAULT_LIMIT = 20;
// Máximo por página: nadie puede pedir todas las filas de golpe
export const MAX_LIMIT = 100;

// Parámetros ?offset=&limit= de las listas (TMF630). Llegan como texto en la
// URL: @Type los convierte en número antes de validarlos
export class PaginationQueryDto {
  @ApiPropertyOptional({
    minimum: 0,
    default: 0,
    description: 'Number of items to skip',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset: number = 0;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_LIMIT,
    default: DEFAULT_LIMIT,
    description: 'Maximum number of items to return',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit: number = DEFAULT_LIMIT;
}
