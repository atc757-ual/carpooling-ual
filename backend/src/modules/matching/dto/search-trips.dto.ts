import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import type { TripDirection } from '../candidate-source';

export const TRIP_DIRECTIONS: readonly TripDirection[] = [
  'to-campus',
  'from-campus',
];
export const DEFAULT_MARGIN_MIN = 20;

// Búsqueda de viajes del pasajero (RF-06, RF-07)
export class SearchTripsDto {
  @ApiProperty({
    type: GeoPointDto,
    description:
      'Address outside the campus: where to be picked up (to campus) or dropped off (from campus)',
    example: { type: 'Point', coordinates: [-2.6, 36.76] },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  place!: GeoPointDto;

  @ApiProperty({ description: 'Campus parking', example: 'p1' })
  @IsString()
  @IsNotEmpty()
  parkingId!: string;

  @ApiProperty({ enum: TRIP_DIRECTIONS, example: 'to-campus' })
  @IsIn(TRIP_DIRECTIONS)
  direction!: TripDirection;

  @ApiProperty({
    description:
      'Desired time: arrival at the campus (to campus) or departure from it (from campus)',
    example: '2026-10-28T08:00:00.000Z',
  })
  @Type(() => Date)
  @IsDate()
  desiredAt!: Date;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 60,
    default: DEFAULT_MARGIN_MIN,
    description: 'Accepted difference with the desired time, in minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  marginMin?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 8, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(8)
  seats?: number;
}
