import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { IncidentView } from '../incidents/incidents.service';
import { ConversationReportsService } from '../incidents/conversation-reports.service';
import { ChatService } from './chat.service';
import { ChatMessage } from './entities/chat-message.entity';
import type { QuickReply } from './entities/chat-message.entity';

// Cuántos mensajes se copian como mucho en la denuncia (los últimos): los
// chats son cortos, es un tope por si acaso
export const MAX_REPORTED_MESSAGES = 200;

// El texto de cada respuesta rápida, como lo vio quien la recibió (los de la
// app en español). La copia es un texto fijo para el administrador: la clave
// sola (at_pickup) no se entiende
const QUICK_REPLY_COPY: Readonly<Record<QuickReply, string>> = {
  at_pickup: 'Ya estoy en el punto',
  running_late: 'Llego 5 min tarde',
  on_my_way: 'Estoy en camino',
  where_are_you: '¿Dónde estás?',
};

// «Ya estoy en el punto (respuesta rápida)»
export function quickReplyCopy(quickReply: QuickReply | null): string {
  return quickReply
    ? `${QUICK_REPLY_COPY[quickReply]} (respuesta rápida)`
    : '(mensaje vacío)';
}

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
    const messages = latest.toReversed();
    const views = await this.chat.toViews(trip, messages);
    return this.conversationReports.report(
      userId,
      {
        tripId,
        driverId: trip.driverId,
        messages: views.map(({ message, author, authorRole }) => ({
          authorName: author.name,
          authorRole,
          text: message.body ?? quickReplyCopy(message.quickReply),
          createdAt: message.createdAt,
        })),
        omittedCount: total - messages.length,
      },
      reason,
    );
  }
}
