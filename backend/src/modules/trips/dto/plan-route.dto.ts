import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';

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
}
