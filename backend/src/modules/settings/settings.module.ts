import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../audit/audit.module';
import { UsersModule } from '../users/users.module';
import { PlatformSetting } from './entities/platform-setting.entity';
import {
  AdminSettingsController,
  SettingsController,
} from './settings.controller';
import { SettingsService } from './settings.service';

// Ajustes de la plataforma que cambia el administrador (p. ej. publicar
// varios días a la vez). Exporta SettingsService para que otros módulos los
// apliquen
@Module({
  imports: [
    TypeOrmModule.forFeature([PlatformSetting]),
    AuditModule,
    UsersModule,
  ],
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
