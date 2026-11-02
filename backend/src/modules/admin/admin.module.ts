import { Module } from '@nestjs/common';
import { EventsModule } from '../../events/events.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { AdminOverviewController } from './admin-overview.controller';
import { AdminUsersController } from './admin-users.controller';
import { AdminUserDetailService } from './admin-user-detail.service';
import { AdminUsersService } from './admin-users.service';

// Panel de administración (bloque b): sin tablas propias, compone lo que
// exportan los demás módulos. Nadie depende de él, así que puede usarlos a
// todos sin dependencias circulares
@Module({
  imports: [
    UsersModule,
    TripsModule,
    RequestsModule,
    IncidentsModule,
    EventsModule,
  ],
  controllers: [AdminUsersController, AdminOverviewController],
  providers: [AdminUsersService, AdminUserDetailService],
})
export class AdminModule {}
