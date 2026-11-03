import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
import { EventsModule } from '../../events/events.module';
import { CatalogsModule } from '../catalogs/catalogs.module';
import { NotificationsModule } from '../notifications/notifications.module';
import {
  AdminAvatarsController,
  AdminAvatarUploadsController,
  AvatarsController,
} from './avatars.controller';
import { AvatarsService } from './avatars.service';
import { LegalDocument } from './entities/legal-document.entity';
import {
  AdminLegalDocumentsController,
  LegalDocumentsController,
} from './legal-documents.controller';
import { LegalDocumentsService } from './legal-documents.service';
import { ConsentsService } from './consents.service';
import { AdminProfile } from './entities/admin-profile.entity';
import { Avatar } from './entities/avatar.entity';
import { DriverProfile } from './entities/driver-profile.entity';
import { PassengerProfile } from './entities/passenger-profile.entity';
import { UserConsent } from './entities/user-consent.entity';
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
      Avatar,
      UserConsent,
      LegalDocument,
    ]),
    CatalogsModule,
    NotificationsModule,
    EventsModule,
    AuditModule,
  ],
  controllers: [
    UsersController,
    VehiclesController,
    AvatarsController,
    LegalDocumentsController,
    AdminLegalDocumentsController,
    AdminAvatarsController,
    AdminAvatarUploadsController,
  ],
  providers: [
    UsersService,
    VehiclesService,
    UserProfilesService,
    AvatarsService,
    LegalDocumentsService,
    ConsentsService,
  ],
  // Lo único visible desde otros módulos (p. ej. auth, trips): las fronteras entre
  // módulos se respetan porque nadie más puede usar sus repositorios
  exports: [
    UsersService,
    VehiclesService,
    UserProfilesService,
    ConsentsService,
  ],
})
export class UsersModule {}
