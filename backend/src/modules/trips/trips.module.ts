import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
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
import { TripStatsService } from './trip-stats.service';
import { TripsService } from './trips.service';
import { TripLifecycleScheduler } from './trip-lifecycle.scheduler';

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
    AuditModule,
  ],
  controllers: [TripsController],
  providers: [
    TripsService,
    TripStatusService,
    TripRoutesService,
    TripCandidatesService,
    OsrmClient,
    LateCancellationsService,
    TripStatsService,
    TripLifecycleScheduler,
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
    TripStatsService,
    TripLifecycleScheduler,
  ],
})
export class TripsModule {}
