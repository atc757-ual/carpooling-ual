import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { Incident } from './entities/incident.entity';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';
import { ConversationReportsService } from './conversation-reports.service';

// Incidencias (RF-23, CU-12). Usa trips (cancelar un viaje en curso) y
// requests (el pasajero abandona el viaje); ninguno de los dos depende de este
// módulo. Avisa de cada incidencia nueva a los administradores (RF-19)
@Module({
  imports: [
    TypeOrmModule.forFeature([Incident]),
    TripsModule,
    RequestsModule,
    UsersModule,
    EventsModule,
    NotificationsModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService, ConversationReportsService],
  // Lo usa el panel de administración (incidencias abiertas por usuario)
  exports: [IncidentsService, ConversationReportsService],
})
export class IncidentsModule {}
