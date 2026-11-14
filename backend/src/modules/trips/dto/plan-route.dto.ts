import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDefined,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { MAX_TRIP_STOPS } from '../trip-timing';

export class PlanRouteDto {
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
    type: [GeoPointDto],
    maxItems: MAX_TRIP_STOPS,
    description:
      'Stops to go through, in any order: they are ordered along the route, as when publishing',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_TRIP_STOPS)
  @ValidateNested({ each: true })
  @Type(() => GeoPointDto)
  via?: GeoPointDto[];
}
