import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../../events/events.module';
import { PlacesModule } from '../places/places.module';
import { UsersModule } from '../users/users.module';
import { LateCancellation } from './entities/late-cancellation.entity';
import { TripPickup } from './entities/trip-pickup.entity';
import { TripRoute } from './entities/trip-route.entity';
import { Trip } from './entities/trip.entity';
import { LateCancellationsService } from './late-cancellations.service';
import { OsrmClient } from './osrm.client';
import { TripCandidatesService } from './trip-candidates.service';
import { TripRoutesService } from './trip-routes.service';
import { TripStatusService } from './trip-status.service';
import { TripsController } from './trips.controller';
import { TripStatsService } from './trip-stats.service';
import { TripViewerAccessService } from './trip-viewer-access.service';
import { TripLookupService } from './trip-lookup.service';
import { TripPickupsService } from './trip-pickups.service';
import { PublishingLimitsService } from './publishing-limits.service';
import { TripsService } from './trips.service';
import { TripLifecycleScheduler } from './trip-lifecycle.scheduler';
import { TripRemindersService } from './trip-reminders.service';
import { TripExpiryService } from './trip-expiry.service';

// Viajes (RF-04, RF-05, RF-11), sus rutas (RF-12, con OSRM) y las
// cancelaciones tardías (que suspenden la publicación). Usa los
// services que exporta users (estado del conductor y sus vehículos) y
// registra sus cambios de estado como eventos para el Gemelo Digital
// (EventsModule)
@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripRoute, TripPickup, LateCancellation]),
    UsersModule,
    PlacesModule,
    EventsModule,
    AuditModule,
    NotificationsModule,
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
    TripRemindersService,
    TripExpiryService,
    TripViewerAccessService,
    TripLookupService,
    TripPickupsService,
    PublishingLimitsService,
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
    TripViewerAccessService,
    TripLookupService,
    TripPickupsService,
  ],
})
export class TripsModule {}
