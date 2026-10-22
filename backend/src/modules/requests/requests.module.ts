import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestsController } from './requests.controller';
import { RequestViewsService } from './request-views.service';
import { RequestsService } from './requests.service';
import { TripChangesListener } from './trip-changes.listener';

// Solicitudes de plaza (RF-08 a RF-10). Depende de trips (plazas y estado del
// viaje) y de users (nombres, prioridad y matrícula); trips NO depende de
// este módulo: le avisa de las cancelaciones con el patrón observador
@Module({
  imports: [
    TypeOrmModule.forFeature([SeatRequest]),
    TripsModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService, RequestViewsService, TripChangesListener],
})
export class RequestsModule {}
