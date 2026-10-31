import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { Review } from './entities/review.entity';
import { ReputationController } from './reputation.controller';
import { ReputationService } from './reputation.service';

// Reputación y reseñas por rol (RF-22, doble ciego). Usa trips (estado y
// ventana del viaje), requests (pasajeros aceptados) y users (perfiles y
// medias por rol); ninguno de ellos depende de este módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([Review]),
    TripsModule,
    RequestsModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [ReputationController],
  providers: [ReputationService],
  exports: [ReputationService],
})
export class ReputationModule {}

