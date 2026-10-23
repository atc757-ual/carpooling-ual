import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { TripPosition } from './entities/trip-position.entity';
import { TrackingController } from './tracking.controller';
import { TripPositionsService } from './trip-positions.service';

// Seguimiento real del viaje (RF-12). Usa trips (estado del viaje y lo que
// queda con OSRM) y requests (quién es pasajero aceptado); ninguno de los dos
// depende de este módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([TripPosition]),
    TripsModule,
    RequestsModule,
    EventsModule,
  ],
  controllers: [TrackingController],
  providers: [TripPositionsService],
})
export class TrackingModule {}
