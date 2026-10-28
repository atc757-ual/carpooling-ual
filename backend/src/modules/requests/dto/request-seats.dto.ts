import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MAX_REQUESTED_SEATS = 4;

// Cuerpo (opcional) de POST /api/trips/{tripId}/requests: cuántas plazas
// pide el pasajero (él y sus compañeros)
export class RequestSeatsDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_REQUESTED_SEATS,
    default: 1,
    description: 'Seats for the passenger and their companions',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_REQUESTED_SEATS)
  seats?: number;
}
