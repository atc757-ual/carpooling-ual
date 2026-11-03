import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, ValidateNested } from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';

// Cuerpo (opcional) de POST /api/trips/{id}/finish: dónde está el conductor
// al terminar, para guardar a cuántos metros del destino lo hace
export class FinishTripDto {
  @ApiPropertyOptional({
    type: GeoPointDto,
    description:
      'Where the driver is when finishing; stores the distance to the destination',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoPointDto)
  position?: GeoPointDto;
}
