import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CampusParkingsController } from './campus-parkings.controller';
import { CampusParkingsService } from './campus-parkings.service';
import { CampusParking } from './entities/campus-parking.entity';

// Lugares de referencia: los parkings del campus y la zona con cobertura
// (tabla service_areas, que usarán la búsqueda de direcciones y el matching)
@Module({
  imports: [TypeOrmModule.forFeature([CampusParking])],
  controllers: [CampusParkingsController],
  providers: [CampusParkingsService],
  exports: [CampusParkingsService],
})
export class PlacesModule {}
