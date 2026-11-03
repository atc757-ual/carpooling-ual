import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PushConfig } from '../../config/push.config';
import { DisabledPushSender } from './disabled-push-sender';
import { FcmPushSender } from './fcm-push-sender';
import { MemoryPushSender } from './memory-push-sender';
import { PushSender } from './push-sender';

// Elige al arrancar cómo se envían las push (PUSH_TRANSPORT): por Firebase,
// en memoria (tests) o no se envían (sin cuenta de servicio)
export function createPushSender(config: PushConfig): PushSender {
  if (config.transport === 'memory') {
    return new MemoryPushSender();
  }
  if (config.transport === 'fcm' && config.serviceAccountPath) {
    return FcmPushSender.fromServiceAccount(config.serviceAccountPath);
  }
  return new DisabledPushSender();
}

@Module({
  providers: [
    {
      provide: PushSender,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createPushSender(configService.getOrThrow<PushConfig>('push')),
    },
  ],
  exports: [PushSender],
})
export class PushSenderModule {}
