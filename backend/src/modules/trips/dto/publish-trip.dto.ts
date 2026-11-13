import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDate,
  IsDefined,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateBy,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { TRIP_PICKUP_MODES } from '../entities/trip.entity';
import type { TripPickupMode } from '../entities/trip.entity';
import {
  ALLOWED_MAX_DETOUR_M,
  DEFAULT_MAX_DETOUR_M,
  MAX_TRIP_STOPS,
} from '../trip-timing';

// Una parada (recogida en puntos): un lugar público que elige el conductor
export class TripStopInputDto {
  @ApiProperty({ maxLength: 160, example: 'Av. del Mediterráneo, 2' })
  @IsString()
  @Length(1, 160)
  name!: string;

  @ApiProperty({
    type: GeoPointDto,
    example: { type: 'Point', coordinates: [-2.4489, 36.8389] },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location!: GeoPointDto;
}

// Cuerpo de POST /api/trips (RF-04). Valida la FORMA; las reglas de negocio
// (conductor listo, vehículo suyo, plazas ≤ capacidad, salida futura) están
// en TripsService. La hora, de salida o de llegada (una de las dos)
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

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-11-03T07:30:00Z',
    description: 'When the driver leaves. Send it or arrivalAt, not both',
  })
  @ValidateIf((dto: PublishTripDto) => dto.arrivalAt === undefined)
  @Type(() => Date)
  @IsDate()
  departureAt?: Date;

  @ApiPropertyOptional({
    format: 'date-time',
    example: '2026-11-03T08:00:00Z',
    description:
      'Latest arrival at the destination (e.g. to the campus). The departure is computed from the route and the maximum detour, so the driver arrives on time even after picking someone up. Send it or departureAt, not both',
  })
  @Type(() => Date)
  @ValidateBy({
    name: 'arrivalOrDeparture',
    validator: {
      validate: (value: unknown, args): boolean => {
        const hasDeparture =
          (args?.object as PublishTripDto).departureAt !== undefined;
        return hasDeparture
          ? value === undefined
          : value instanceof Date && !Number.isNaN(value.getTime());
      },
      defaultMessage: () => 'send either departureAt or arrivalAt',
    },
  })
  arrivalAt?: Date;

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
    description:
      'Detour budget of the whole trip, in minutes: the detours and stops (2 min each) of every accepted passenger',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  maxDetourMin?: number;

  @ApiPropertyOptional({
    enum: TRIP_PICKUP_MODES,
    default: 'on_route',
    description:
      'How the driver picks up: on the route, up to maxDetourM, or at the stops (only towards the campus)',
  })
  @IsOptional()
  @IsIn(TRIP_PICKUP_MODES)
  pickupMode?: TripPickupMode;

  @ApiPropertyOptional({
    type: [TripStopInputDto],
    minItems: 1,
    maxItems: MAX_TRIP_STOPS,
    description:
      'With pickupMode stops: the stops on the way to the campus, in any order (they are ordered along the route)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TRIP_STOPS)
  @ValidateNested({ each: true })
  @Type(() => TripStopInputDto)
  stops?: TripStopInputDto[];

  @ApiPropertyOptional({
    enum: ALLOWED_MAX_DETOUR_M,
    default: DEFAULT_MAX_DETOUR_M,
    description:
      'Metres the driver goes off the route to pick up (only on the route)',
  })
  @IsOptional()
  @IsIn(ALLOWED_MAX_DETOUR_M)
  maxDetourM?: number;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Name of the origin as chosen when publishing',
    example: 'Roquetas de Mar',
  })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  originName?: string;

  @ApiPropertyOptional({
    maxLength: 160,
    description: 'Name of the destination as chosen when publishing',
    example: 'Campus UAL · Parking P1 (Sur)',
  })
  @IsOptional()
  @IsString()
  @Length(1, 160)
  destinationName?: string;
}
