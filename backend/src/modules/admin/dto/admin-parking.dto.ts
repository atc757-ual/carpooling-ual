import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import {
  CampusParkingResource,
  toCampusParkingResource,
} from '../../places/dto/campus-parking.resource';
import type { CampusParking } from '../../places/entities/campus-parking.entity';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export class CreateParkingDto {
  @ApiProperty({ example: 'Parking P6 (Norte)', maxLength: 60 })
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  @Matches(HAS_LETTER_OR_DIGIT)
  name: string;

  @ApiProperty({
    type: GeoPointDto,
    description: 'Inside the service area',
    example: { type: 'Point', coordinates: [-2.4052, 36.8317] },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location: GeoPointDto;
}

// Solo cambia lo enviado; el id no cambia nunca
export class UpdateParkingDto {
  @ApiPropertyOptional({ example: 'Parking P6 (Norte)', maxLength: 60 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(60)
  @Matches(HAS_LETTER_OR_DIGIT)
  name?: string;

  @ApiPropertyOptional({
    type: GeoPointDto,
    description: 'Inside the service area; not while it has active trips',
    example: { type: 'Point', coordinates: [-2.4052, 36.8317] },
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  location?: GeoPointDto;

  @ApiPropertyOptional({
    example: false,
    description: 'Closing it is not allowed while it has active trips',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// En el panel: también si está abierto y su orden
export class AdminParkingResource extends CampusParkingResource {
  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 1 })
  sortOrder: number;
}

export function toAdminParkingResource(
  parking: CampusParking,
): AdminParkingResource {
  return {
    ...toCampusParkingResource(parking),
    isActive: parking.isActive,
    sortOrder: parking.sortOrder,
  };
}

export function toGeoPoint(location: GeoPointDto): {
  lon: number;
  lat: number;
} {
  const [lon, lat] = location.coordinates;
  return { lon, lat };
}
