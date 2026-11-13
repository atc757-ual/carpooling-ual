import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
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
import { ALLOWED_MAX_DETOUR_M, DEFAULT_MAX_DETOUR_M } from '../trip-timing';

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

  // Las paradas (stops) llegan en el siguiente cambio: por ahora, en ruta
  @ApiPropertyOptional({
    enum: ['on_route'],
    default: 'on_route',
    description: 'How the driver picks up: on the route, up to maxDetourM',
  })
  @IsOptional()
  @IsIn(['on_route'])
  pickupMode?: 'on_route';

  @ApiPropertyOptional({
    enum: ALLOWED_MAX_DETOUR_M,
    default: DEFAULT_MAX_DETOUR_M,
    description: 'Metres the driver goes off the route to pick up',
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
