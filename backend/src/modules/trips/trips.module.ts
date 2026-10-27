import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { UsersModule } from '../users/users.module';
import { TripRoute } from './entities/trip-route.entity';
import { Trip } from './entities/trip.entity';
import { OsrmClient } from './osrm.client';
import { TripCandidatesService } from './trip-candidates.service';
import { TripRoutesService } from './trip-routes.service';
import { TripStatusService } from './trip-status.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

// Viajes (RF-04, RF-05, RF-11) y sus rutas (RF-12, con OSRM). Usa los
// services que exporta users (estado del conductor y sus vehículos) y
// registra sus cambios de estado como eventos para el Gemelo Digital
// (EventsModule)
@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripRoute]),
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
  ],
  // Los usan las solicitudes de plaza (requests), el seguimiento (tracking:
  // lo que queda hasta el destino) y el matching (los candidatos)
  exports: [
    TripsService,
    TripStatusService,
    TripRoutesService,
    TripCandidatesService,
  ],
})
export class TripsModule {}
