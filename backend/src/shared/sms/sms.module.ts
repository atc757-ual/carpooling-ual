import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailConfig } from '../../config/mail.config';
import type { SmsConfig } from '../../config/sms.config';
import { MailpitSmsSender } from './mailpit-sms-sender';
import { MemorySmsSender } from './memory-sms-sender';
import { SmsSender } from './sms-sender';

export function createSmsSender(
  smsConfig: SmsConfig,
  mailConfig: MailConfig,
): SmsSender {
  return smsConfig.transport === 'memory'
    ? new MemorySmsSender()
    : new MailpitSmsSender(mailConfig.smtp, mailConfig.from);
}

@Module({
  providers: [
    {
      provide: SmsSender,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createSmsSender(
          configService.getOrThrow<SmsConfig>('sms'),
          configService.getOrThrow<MailConfig>('mail'),
        ),
    },
  ],
  exports: [SmsSender],
})
export class SmsModule {}
