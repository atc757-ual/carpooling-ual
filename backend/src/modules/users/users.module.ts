import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { AdminProfile } from './entities/admin-profile.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { PassengerProfile } from './entities/passenger-profile.entity';
import { User } from './entities/user.entity';
import { Vehicle } from './entities/vehicle.entity';
import { UsersController } from './users.controller';
import { UserProfilesService } from './user-profiles.service';
import { UsersService } from './users.service';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';

// forFeature registra las entidades de este módulo: TypeORM las conecta con sus
// tablas y NestJS podrá inyectar sus repositorios en los services del módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      DriverProfile,
      PassengerProfile,
      AdminProfile,
      Vehicle,
    ]),
    EventsModule,
  ],
  controllers: [UsersController, VehiclesController],
  providers: [UsersService, VehiclesService, UserProfilesService],
  // Lo único visible desde otros módulos (p. ej. auth, trips): las fronteras entre
  // módulos se respetan porque nadie más puede usar sus repositorios
  exports: [UsersService, VehiclesService, UserProfilesService],
})
export class UsersModule {}
