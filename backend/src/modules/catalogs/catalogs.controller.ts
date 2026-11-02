import { catalogControllers } from './catalog.controllers';
import {
  CreateCatalogItemDto,
  UpdateCatalogItemDto,
} from './dto/catalog-item.dto';
import {
  AdminVehicleBrandResource,
  toAdminVehicleBrandResource,
  toVehicleBrandResource,
  VehicleBrandResource,
} from './dto/vehicle-brand.resource';
import {
  AdminVehicleColorResource,
  CreateVehicleColorDto,
  toAdminVehicleColorResource,
  toVehicleColorResource,
  UpdateVehicleColorDto,
  VehicleColorResource,
} from './dto/vehicle-color.resource';
import { VehicleBrandsService } from './vehicle-brands.service';
import { VehicleColorsService } from './vehicle-colors.service';

// Marcas de coche: la app ve las activas (sugerencias del formulario)
export const [VehicleBrandsController, AdminVehicleBrandsController] =
  catalogControllers({
    path: 'vehicle-brands',
    label: 'vehicle brand',
    example: 'alfa-romeo',
    service: VehicleBrandsService,
    publicListsAll: false,
    publicResource: VehicleBrandResource,
    toPublic: toVehicleBrandResource,
    adminResource: AdminVehicleBrandResource,
    toAdmin: toAdminVehicleBrandResource,
    createDto: CreateCatalogItemDto,
    updateDto: UpdateCatalogItemDto,
  });

// Colores del vehículo: la app los ve todos, para nombrar el de cada
// vehículo, y solo ofrece los activos
export const [VehicleColorsController, AdminVehicleColorsController] =
  catalogControllers({
    path: 'vehicle-colors',
    label: 'vehicle color',
    example: 'blue',
    service: VehicleColorsService,
    publicListsAll: true,
    publicResource: VehicleColorResource,
    toPublic: toVehicleColorResource,
    adminResource: AdminVehicleColorResource,
    toAdmin: toAdminVehicleColorResource,
    createDto: CreateVehicleColorDto,
    updateDto: UpdateVehicleColorDto,
  });
