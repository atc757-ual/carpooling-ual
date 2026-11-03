import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IncidentView } from '../incidents/incidents.service';
import { MessageReportsService } from '../incidents/message-reports.service';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatMessageNotFoundError } from './errors/chat-message-not-found.error';
import { ChatOwnMessageError } from './errors/chat-own-message.error';

// Denunciar un mensaje del chat del viaje: quien participa denuncia el
// mensaje de otro; el módulo de incidencias crea la incidencia (sin cancelar
// nada) con una copia del mensaje
@Injectable()
export class ChatReportsService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    private readonly chat: ChatService,
    private readonly messageReports: MessageReportsService,
  ) {}

  async report(
    userId: string,
    tripId: string,
    messageId: string,
    reason: string,
  ): Promise<IncidentView> {
    const { trip } = await this.chat.getAccess(userId, tripId);
    const message = await this.messagesRepository.findOneBy({
      id: messageId,
      tripId,
    });
    if (!message) {
      throw new ChatMessageNotFoundError(messageId);
    }
    if (message.authorId === userId) {
      throw new ChatOwnMessageError(messageId);
    }
    const [view] = await this.chat.toViews(trip, [message]);
    return this.messageReports.report(
      userId,
      {
        id: message.id,
        tripId,
        driverId: trip.driverId,
        authorName: view.author.name,
        authorRole: view.authorRole,
        text: message.body ?? `(respuesta rápida: ${message.quickReply})`,
        createdAt: message.createdAt,
      },
      reason,
    );
  }
}
