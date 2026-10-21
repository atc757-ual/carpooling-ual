import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { loadConfiguration } from './config/configuration';
import { AuthModule } from './modules/auth/auth.module';
import { DigitalTwinModule } from './modules/digital-twin/digital-twin.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { MatchingModule } from './modules/matching/matching.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { TripsModule } from './modules/trips/trips.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env de backend/ o, si no existe, el de la raíz del repositorio
      envFilePath: ['.env', '../.env'],
      load: [loadConfiguration],
    }),
    AuthModule,
    UsersModule,
    TripsModule,
    RequestsModule,
    IncidentsModule,
    NotificationsModule,
    MatchingModule,
    DigitalTwinModule,
    SimulationModule,
    MetricsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
