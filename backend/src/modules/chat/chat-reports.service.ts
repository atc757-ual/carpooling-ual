import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IncidentView } from '../incidents/incidents.service';
import { ConversationReportsService } from '../incidents/conversation-reports.service';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';

// Cuántos mensajes se copian como mucho en la denuncia (los últimos): los
// chats son cortos, es un tope por si acaso
export const MAX_REPORTED_MESSAGES = 200;

// Denunciar el chat de un viaje: quien participa lo denuncia con un motivo y
// el módulo de incidencias crea la incidencia (sin cancelar nada) con una
// copia de la conversación. Se puede aunque el chat ya no admita mensajes
@Injectable()
export class ChatReportsService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    private readonly chat: ChatService,
    private readonly conversationReports: ConversationReportsService,
  ) {}

  async report(
    userId: string,
    tripId: string,
    reason: string,
  ): Promise<IncidentView> {
    const { trip } = await this.chat.getAccess(userId, tripId);
    // Los últimos, y luego del más antiguo al más nuevo
    const [latest, total] = await this.messagesRepository.findAndCount({
      where: { tripId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: MAX_REPORTED_MESSAGES,
    });
    const messages = latest.reverse();
    const views = await this.chat.toViews(trip, messages);
    return this.conversationReports.report(
      userId,
      {
        tripId,
        driverId: trip.driverId,
        messages: views.map(({ message, author, authorRole }) => ({
          authorName: author.name,
          authorRole,
          text: message.body ?? `(respuesta rápida: ${message.quickReply})`,
          createdAt: message.createdAt,
        })),
        omittedCount: total - messages.length,
      },
      reason,
    );
  }
}
