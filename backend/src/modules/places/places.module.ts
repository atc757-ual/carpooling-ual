import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { CampusParkingsController } from './campus-parkings.controller';
import { CampusParkingsService } from './campus-parkings.service';
import { CampusParking } from './entities/campus-parking.entity';
import { CartoCiudadGeocoder } from './geocoder/cartociudad-geocoder';
import { GEOCODER } from './geocoder/geocoder';
import { PlacesController } from './places.controller';
import { PlacesService } from './places.service';

// Lugares de referencia y direcciones: los parkings del campus, la zona con
// cobertura (tabla service_areas) y la búsqueda de direcciones con el
// geocodificador (CartoCiudad; los tests e2e lo sustituyen por uno falso)
@Module({
  imports: [TypeOrmModule.forFeature([CampusParking]), EventsModule],
  controllers: [CampusParkingsController, PlacesController],
  providers: [
    CampusParkingsService,
    PlacesService,
    { provide: GEOCODER, useClass: CartoCiudadGeocoder },
  ],
  exports: [CampusParkingsService],
})
export class PlacesModule {}
