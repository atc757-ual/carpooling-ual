import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsModule } from '../../events/events.module';
import { RequestsModule } from '../requests/requests.module';
import { TripsModule } from '../trips/trips.module';
import { UsersModule } from '../users/users.module';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ConversationsService } from './conversations.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatRead } from './entities/chat-read.entity';

// Chat del viaje entre el conductor y sus pasajeros aceptados. Usa trips (el
// viaje y su estado), requests (los pasajeros aceptados) y users (nombres y
// avatares); ninguno depende de este módulo
@Module({
  imports: [
    TypeOrmModule.forFeature([ChatMessage, ChatRead]),
    TripsModule,
    RequestsModule,
    UsersModule,
    EventsModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ConversationsService],
})
export class ChatModule {}
