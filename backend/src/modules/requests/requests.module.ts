import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestAcceptanceListener } from './request-acceptance.listener';
import { RequestOverlapService } from './request-overlap.service';
import { RequestsController } from './requests.controller';
import { RequestViewsService } from './request-views.service';
import { RequestsService } from './requests.service';
import { TripChangesListener } from './trip-changes.listener';

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
    RequestViewsService,
    RequestChangesRecorder,
    RequestOverlapService,
    RequestAcceptanceListener,
    TripChangesListener,
  ],
  // Lo usan las incidencias (el pasajero abandona un viaje en curso)
  exports: [RequestsService],
})
export class RequestsModule {}
