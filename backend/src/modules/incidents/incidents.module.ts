import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { Incident } from './entities/incident.entity';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

// Incidencias (RF-23, CU-12). Usa trips (cancelar un viaje en curso) y
// requests (el pasajero abandona el viaje); ninguno de los dos depende de este
// módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([Incident]),
    TripsModule,
    RequestsModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService],
})
export class IncidentsModule {}
