import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { RequestsModule } from '../requests/requests.module';
import { UsersModule } from '../users/users.module';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { TripsModule } from '../trips/trips.module';
import { TripPosition } from './entities/trip-position.entity';
import { TripShare } from './entities/trip-share.entity';
import { TrackingController } from './tracking.controller';
import { TripPositionsService } from './trip-positions.service';
import { TripSharesController } from './trip-shares.controller';
import { TripSharesService } from './trip-shares.service';

// Seguimiento real del viaje (RF-12) y viaje compartido en directo. Usa trips
// (estado del viaje y lo que queda con OSRM), requests (quién es pasajero
// aceptado y su recogida) y users (la matrícula, para el enlace compartido);
// ninguno de ellos depende de este módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([TripPosition, TripShare]),
    TripsModule,
    RequestsModule,
    UsersModule,
    CatalogsModule,
    EventsModule,
  ],
  controllers: [TrackingController, TripSharesController],
  providers: [TripPositionsService, TripSharesService],
})
export class TrackingModule {}
