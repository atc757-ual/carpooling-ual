import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { loadConfiguration } from './config/configuration';
import { buildTypeOrmOptions } from './config/database.config';
import { AuthModule } from './modules/auth/auth.module';
import { DigitalTwinModule } from './modules/digital-twin/digital-twin.module';
import { AdminModule } from './modules/admin/admin.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { MatchingModule } from './modules/matching/matching.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PlacesModule } from './modules/places/places.module';
import { ReputationModule } from './modules/reputation/reputation.module';
import { ChatModule } from './modules/chat/chat.module';
import { RequestsModule } from './modules/requests/requests.module';
import { SimulationModule } from './modules/simulation/simulation.module';
import { SupportModule } from './modules/support/support.module';
import { TrackingModule } from './modules/tracking/tracking.module';
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
    ScheduleModule.forRoot({
      cronJobs: process.env.NODE_ENV !== 'test',
    }),
    // Conexión a PostgreSQL. "Async" porque necesita esperar a que ConfigService
    // haya leído DATABASE_URL del .env; NestJS se lo inyecta a useFactory
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildTypeOrmOptions(configService.getOrThrow<string>('databaseUrl')),
    }),
    AuthModule,
    UsersModule,
    TripsModule,
    TrackingModule,
    RequestsModule,
    ReputationModule,
    ChatModule,
    IncidentsModule,
    NotificationsModule,
    SupportModule,
    PlacesModule,
    CatalogsModule,
    MatchingModule,
    DigitalTwinModule,
    SimulationModule,
    AdminModule,
    MetricsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
