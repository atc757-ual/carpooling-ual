import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushModule } from '../push/push.module';
import { Notification } from './entities/notification.entity';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

// Avisos dentro de la aplicación (RF-19, CU-11). Lo usan requests e
// incidents para avisar; solo depende de push (los importantes, también por
// push)
@Module({
  imports: [TypeOrmModule.forFeature([Notification]), PushModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
