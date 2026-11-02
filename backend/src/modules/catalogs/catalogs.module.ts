import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import {
  AdminVehicleBrandsController,
  AdminVehicleColorsController,
  VehicleBrandsController,
  VehicleColorsController,
} from './catalogs.controller';
import { VehicleBrand } from './entities/vehicle-brand.entity';
import { VehicleColor } from './entities/vehicle-color.entity';
import { VehicleBrandsService } from './vehicle-brands.service';
import { VehicleColorsService } from './vehicle-colors.service';

// Catálogos que gestiona el panel de administración (marcas, colores,
// preferencias…): la app lee los activos y el administrador los gestiona.
// Exporta los colores para validar el de cada vehículo
@Module({
  imports: [
    TypeOrmModule.forFeature([VehicleBrand, VehicleColor]),
    EventsModule,
  ],
  controllers: [
    VehicleBrandsController,
    AdminVehicleBrandsController,
    VehicleColorsController,
    AdminVehicleColorsController,
  ],
  providers: [VehicleBrandsService, VehicleColorsService],
  exports: [VehicleColorsService],
})
export class CatalogsModule {}
