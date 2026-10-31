import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { UsersModule } from '../users/users.module';
import { LateCancellation } from './entities/late-cancellation.entity';
import { TripRoute } from './entities/trip-route.entity';
import { Trip } from './entities/trip.entity';
import { LateCancellationsService } from './late-cancellations.service';
import { OsrmClient } from './osrm.client';
import { TripCandidatesService } from './trip-candidates.service';
import { TripRoutesService } from './trip-routes.service';
import { TripStatusService } from './trip-status.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

// Viajes (RF-04, RF-05, RF-11), sus rutas (RF-12, con OSRM) y las
// cancelaciones tardías (que suspenden la publicación). Usa los
// services que exporta users (estado del conductor y sus vehículos) y
// registra sus cambios de estado como eventos para el Gemelo Digital
// (EventsModule)
@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripRoute, LateCancellation]),
    UsersModule,
    EventsModule,
  ],
  controllers: [TripsController],
  providers: [
    TripsService,
    TripStatusService,
    TripRoutesService,
    TripCandidatesService,
    OsrmClient,
    LateCancellationsService,
  ],
  // Los usan las solicitudes de plaza (requests), el seguimiento (tracking:
  // lo que queda hasta el destino) y el matching (los candidatos); las
  // solicitudes también, las cancelaciones tardías del pasajero
  exports: [
    TripsService,
    TripStatusService,
    TripRoutesService,
    TripCandidatesService,
    LateCancellationsService,
  ],
})
export class TripsModule {}
