import { Module } from '@nestjs/common';
import { MailModule } from '../../shared/mail/mail.module';
import { UsersModule } from '../users/users.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

// «Ayuda y soporte» (POST /api/support/messages): solo envía un correo, no
// tiene tablas
@Module({
  imports: [UsersModule, MailModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
