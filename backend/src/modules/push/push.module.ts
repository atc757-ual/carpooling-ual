import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSenderModule } from '../../shared/push/push.module';
import { PushToken } from './entities/push-token.entity';
import { PushController } from './push.controller';
import { PushTokensService } from './push-tokens.service';
import { PushService } from './push.service';

// Notificaciones push: los tokens de cada dispositivo y el envío (tras
// confirmarse el cambio). No depende de ningún otro módulo; lo usan
// notifications (avisos) y chat (mensajes)
@Module({
  imports: [TypeOrmModule.forFeature([PushToken]), PushSenderModule],
  controllers: [PushController],
  providers: [PushTokensService, PushService],
  exports: [PushService],
})
export class PushModule {}
