import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PushModule } from '../push/push.module';
import { ChatController } from './chat.controller';
import { ChatReportsService } from './chat-reports.service';
import { ChatRetentionScheduler } from './chat-retention.scheduler';
import { ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';

// Chat del viaje entre el conductor y sus pasajeros aceptados. Usa trips (el
// viaje y su estado), requests (los pasajeros aceptados) y users (nombres y
// avatares), incidents (las denuncias) y push (avisar de los mensajes);
// ninguno depende de este módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatRead]),
    TripsModule,
    RequestsModule,
    UsersModule,
    EventsModule,
    IncidentsModule,
    PushModule,
  ],
  controllers: [ChatController],
  providers: [
    ChatService,
    ConversationsService,
    ChatRetentionScheduler,
    ChatReportsService,
  ],
})
export class ChatModule {}
