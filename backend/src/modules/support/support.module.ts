import { Module } from '@nestjs/common';
import { MailModule } from '../../shared/mail/mail.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { SupportController } from './support.controller';
import { SupportService } from './support.service';

// «Ayuda y soporte» (POST /api/support/messages): solo envía un correo, no
// tiene tablas. Lee el viaje del que trata (si lo hay) de viajes y solicitudes
@Module({
  imports: [UsersModule, TripsModule, RequestsModule, MailModule],
  controllers: [SupportController],
  providers: [SupportService],
})
export class SupportModule {}
