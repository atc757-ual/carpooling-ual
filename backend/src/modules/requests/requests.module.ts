import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MailModule } from '../../shared/mail/mail.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestAcceptanceListener } from './request-acceptance.listener';
import { RequestPickupsService } from './request-pickups.service';
import { RequestDropOffService } from './request-drop-off.service';
import { RequestOverlapService } from './request-overlap.service';
import { RequestsController } from './requests.controller';
import { RequestViewsService } from './request-views.service';
import { MyTripEntriesController } from './my-trip-entries.controller';
import { MyTripEntriesService } from './my-trip-entries.service';
import { RequestStatsService } from './request-stats.service';
import { RequestsService } from './requests.service';
import { RequestLifecycleScheduler } from './request-lifecycle.scheduler';
import { TripChangesListener } from './trip-changes.listener';
import { TripEmailsListener } from './trip-emails.listener';
import { TripParticipantsController } from './trip-participants.controller';
import { TripParticipantsRegistration } from './trip-participants.registration';
import { TripParticipantsService } from './trip-participants.service';

// Solicitudes de plaza (RF-08 a RF-10). Depende de trips (plazas y estado del
// viaje), de users (nombres, prioridad y matrícula) y de notifications (avisos
// de cada cambio, RF-19); trips NO depende de este módulo: le avisa de las
// cancelaciones con el patrón observador
@Module({
  imports: [
    TypeOrmModule.forFeature([SeatRequest]),
    TripsModule,
    UsersModule,
    EventsModule,
    NotificationsModule,
    MailModule,
  ],
  controllers: [
    RequestsController,
    MyTripEntriesController,
    TripParticipantsController,
  ],
  providers: [
    RequestsService,
    RequestStatsService,
    MyTripEntriesService,
    TripParticipantsService,
    RequestViewsService,
    RequestChangesRecorder,
    RequestOverlapService,
    RequestAcceptanceListener,
    RequestPickupsService,
    RequestDropOffService,
    TripChangesListener,
    TripEmailsListener,
    RequestLifecycleScheduler,
    TripParticipantsRegistration,
  ],
  // Lo usan las incidencias (el pasajero abandona un viaje en curso) y el
  // panel de administración (los recuentos)
  exports: [RequestsService, RequestStatsService, RequestLifecycleScheduler],
})
export class RequestsModule {}
