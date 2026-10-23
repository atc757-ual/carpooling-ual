import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';

// Cuerpo de POST /api/trips/{id}/positions: dónde está ahora el conductor. La
// hora la pone el servidor al recibirla (un reloj de móvil mal puesto no
// influye)
export class ReportPositionDto {
  @ApiProperty({
    type: GeoPointDto,
    example: { type: 'Point', coordinates: [-2.43, 36.833] },
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => GeoPointDto)
  position!: GeoPointDto;
}
