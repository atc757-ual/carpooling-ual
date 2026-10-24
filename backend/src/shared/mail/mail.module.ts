import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MailConfig } from '../../config/mail.config';
import { MailSender } from './mail-sender';
import { MemoryMailSender } from './memory-mail-sender';
import { SmtpMailSender } from './smtp-mail-sender';

// Elige al arrancar cómo se envían los correos (MAIL_TRANSPORT): por SMTP o,
// en los tests, a un buzón en memoria
export function createMailSender(config: MailConfig): MailSender {
  return config.transport === 'memory'
    ? new MemoryMailSender()
    : new SmtpMailSender(config.smtp, config.from);
}

@Module({
  providers: [
    {
      provide: MailSender,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        createMailSender(configService.getOrThrow<MailConfig>('mail')),
    },
  ],
  exports: [MailSender],
})
export class MailModule {}
