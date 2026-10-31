import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';

export const MAX_REQUESTED_SEATS = 4;
const REQUEST_DIRECTIONS = ['to-campus', 'from-campus'] as const;

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

  @ApiPropertyOptional({
    enum: REQUEST_DIRECTIONS,
    description: 'Passenger direction chosen in search',
  })
  @IsOptional()
  @IsIn(REQUEST_DIRECTIONS)
  direction?: (typeof REQUEST_DIRECTIONS)[number];

  @ApiPropertyOptional({
    type: GeoPointDto,
    description:
      'Passenger pickup point for a trip to campus; ignored for the return trip',
    example: { type: 'Point', coordinates: [-2.6, 36.76] },
  })
  @ValidateIf((request: RequestSeatsDto) => request.direction === 'to-campus')
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  pickupLocation?: GeoPointDto;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Label of the passenger pickup point',
    example: 'Calle Profesor Mulián, 29',
  })
  @ValidateIf((request: RequestSeatsDto) => request.direction === 'to-campus')
  @IsDefined()
  @IsString()
  @MaxLength(160)
  pickupName?: string;
}
