import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';
import type { VehicleColor } from '../entities/vehicle-color.entity';
import {
  adminFieldsOf,
  CatalogItemResource,
  CreateCatalogItemDto,
  toCatalogItemResource,
  UpdateCatalogItemDto,
} from './catalog-item.dto';

// #rrggbb, en minúsculas o mayúsculas
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Un color, como lo ve la app: todos, para nombrar el de cada vehículo; solo
// los activos se pueden elegir
export class VehicleColorResource extends CatalogItemResource {
  @ApiProperty({ example: '#2673c9', description: 'Swatch in the light theme' })
  hexLight: string;

  @ApiProperty({ example: '#5b9be0', description: 'Swatch in the dark theme' })
  hexDark: string;

  @ApiProperty({ example: true })
  isActive: boolean;
}

export class AdminVehicleColorResource extends VehicleColorResource {
  @ApiProperty({ example: 4 })
  sortOrder: number;
}

export class CreateVehicleColorDto extends CreateCatalogItemDto {
  @ApiProperty({ example: '#2673c9' })
  @Matches(HEX_COLOR)
  hexLight: string;

  @ApiProperty({ example: '#5b9be0' })
  @Matches(HEX_COLOR)
  hexDark: string;
}

export class UpdateVehicleColorDto extends UpdateCatalogItemDto {
  @ApiPropertyOptional({ example: '#2673c9' })
  @IsOptional()
  @Matches(HEX_COLOR)
  hexLight?: string;

  @ApiPropertyOptional({ example: '#5b9be0' })
  @IsOptional()
  @Matches(HEX_COLOR)
  hexDark?: string;
}

export function toVehicleColorResource(
  color: VehicleColor,
): VehicleColorResource {
  return {
    ...toCatalogItemResource('VehicleColor', color),
    hexLight: color.hexLight,
    hexDark: color.hexDark,
    isActive: color.isActive,
  };
}

export function toAdminVehicleColorResource(
  color: VehicleColor,
): AdminVehicleColorResource {
  return { ...toVehicleColorResource(color), ...adminFieldsOf(color) };
}
