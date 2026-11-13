import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestAcceptanceListener } from './request-acceptance.listener';
import { RequestPickupsService } from './request-pickups.service';
import { RequestOverlapService } from './request-overlap.service';
import { RequestsController } from './requests.controller';
import { RequestViewsService } from './request-views.service';
import { RequestStatsService } from './request-stats.service';
import { RequestsService } from './requests.service';
import { RequestLifecycleScheduler } from './request-lifecycle.scheduler';
import { TripChangesListener } from './trip-changes.listener';
import { TripParticipantsRegistration } from './trip-participants.registration';

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
  ],
  controllers: [RequestsController],
  providers: [
    RequestsService,
    RequestStatsService,
    RequestViewsService,
    RequestChangesRecorder,
    RequestOverlapService,
    RequestAcceptanceListener,
    RequestPickupsService,
    TripChangesListener,
    RequestLifecycleScheduler,
    TripParticipantsRegistration,
  ],
  // Lo usan las incidencias (el pasajero abandona un viaje en curso) y el
  // panel de administración (los recuentos)
  exports: [RequestsService, RequestStatsService, RequestLifecycleScheduler],
})
export class RequestsModule {}
