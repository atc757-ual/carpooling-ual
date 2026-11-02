import { ApiProperty } from '@nestjs/swagger';
import type { VehicleBrand } from '../entities/vehicle-brand.entity';
import {
  adminFieldsOf,
  CatalogItemResource,
  toCatalogItemResource,
} from './catalog-item.dto';

// Una marca, como la ve la app (solo las activas)
export class VehicleBrandResource extends CatalogItemResource {}

// En el panel: también si se ofrece y su orden
export class AdminVehicleBrandResource extends VehicleBrandResource {
  @ApiProperty({ example: true })
  isActive: boolean;

  @ApiProperty({ example: 2 })
  sortOrder: number;
}

export function toVehicleBrandResource(
  brand: VehicleBrand,
): VehicleBrandResource {
  return toCatalogItemResource('VehicleBrand', brand);
}

export function toAdminVehicleBrandResource(
  brand: VehicleBrand,
): AdminVehicleBrandResource {
  return { ...toVehicleBrandResource(brand), ...adminFieldsOf(brand) };
}
