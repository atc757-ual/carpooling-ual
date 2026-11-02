import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { VehicleBrand } from './entities/vehicle-brand.entity';
import {
  AdminVehicleBrandsController,
  VehicleBrandsController,
} from './vehicle-brands.controller';
import { VehicleBrandsService } from './vehicle-brands.service';

// Catálogos que gestiona el panel de administración (marcas, colores,
// preferencias…): la app lee los activos y el administrador los gestiona
@Module({
  imports: [TypeOrmModule.forFeature([VehicleBrand]), EventsModule],
  controllers: [VehicleBrandsController, AdminVehicleBrandsController],
  providers: [VehicleBrandsService],
})
export class CatalogsModule {}
