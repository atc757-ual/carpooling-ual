import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsDefined,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';

// Cuerpo de POST /api/trips (RF-04). Valida la FORMA; las reglas de negocio
// (conductor listo, vehículo suyo, plazas ≤ capacidad, salida futura) están
// en TripsService
export class PublishTripDto {
  @ApiProperty({ format: 'uuid', description: 'One of my active vehicles' })
  @IsUUID()
  vehicleId!: string;

  @ApiProperty({
    type: GeoPointDto,
    example: { type: 'Point', coordinates: [-2.4637, 36.8381] },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  origin!: GeoPointDto;

  @ApiProperty({
    type: GeoPointDto,
    example: { type: 'Point', coordinates: [-2.4058, 36.8297] },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  destination!: GeoPointDto;

  @ApiProperty({ format: 'date-time', example: '2026-11-03T07:30:00Z' })
  @Type(() => Date)
  @IsDate()
  departureAt!: Date;

  @ApiProperty({
    minimum: 1,
    maximum: 8,
    description: 'Seats offered to passengers (at most the vehicle capacity)',
    example: 3,
  })
  @IsInt()
  @Min(1)
  @Max(8)
  offeredSeats!: number;

  @ApiPropertyOptional({
    minimum: 0,
    maximum: 60,
    default: 10,
    description: 'Maximum detour to pick up passengers, in minutes',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  maxDetourMin?: number;
}
