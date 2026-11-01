import { Module } from '@nestjs/common';
import { IncidentsModule } from '../incidents/incidents.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

// Panel de administración (bloque b): sin tablas propias, compone lo que
// exportan los demás módulos. Nadie depende de él, así que puede usarlos a
// todos sin dependencias circulares
@Module({
  imports: [UsersModule, TripsModule, RequestsModule, IncidentsModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
})
export class AdminModule {}
