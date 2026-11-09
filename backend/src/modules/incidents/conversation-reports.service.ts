import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { IncidentsService, IncidentView } from './incidents.service';

// Un mensaje de la conversación denunciada, tal como lo da el chat (este
// módulo no lee sus tablas)
export interface ReportedMessage {
  authorName: string;
  authorRole: 'driver' | 'passenger';
  text: string;
  createdAt: Date;
}

// La conversación denunciada: sus mensajes (los últimos, del más antiguo al
// más nuevo) y cuántos más antiguos no se copian
export interface ReportedConversation {
  tripId: string;
  driverId: string;
  messages: ReportedMessage[];
  omittedCount: number;
}

const TIME_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Denuncia del chat de un viaje: una incidencia para el administrador (CU-12)
// que, a diferencia de las del viaje en curso (RF-23), no cancela nada. La
// descripción lleva una copia de la conversación (los mensajes se borran a los
// 30 días y la administración no lee los chats) y el motivo. Se puede volver a
// denunciar: después pueden llegar mensajes nuevos
@Injectable()
export class ConversationReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly incidentsService: IncidentsService,
  ) {}

  async report(
    reporterId: string,
    conversation: ReportedConversation,
    reason: string,
  ): Promise<IncidentView> {
    const incident = await this.dataSource.transaction(async (manager) => {
      const created = await manager.save(
        manager.create(Incident, {
          tripId: conversation.tripId,
          requestId: null,
          reporterId,
          chatMessageId: null,
          source: 'chat',
          category: 'chat_behavior',
          description: describe(conversation, reason),
        }),
      );
      await this.incidentsService.recordReported(
        manager,
        created,
        conversation.driverId,
      );
      return created;
    });
    return this.incidentsService.toView(incident);
  }
}

// «Chat del viaje denunciado. Motivo: …», y debajo un mensaje por línea:
// «3 nov, 07:05 · Pía R. (pasajero): Estoy en el portal»
export function describe(
  conversation: ReportedConversation,
  reason: string,
): string {
  const lines = conversation.messages.map((message) => {
    const role = message.authorRole === 'driver' ? 'conductor' : 'pasajero';
    return `${TIME_FORMAT.format(message.createdAt)} · ${message.authorName} (${role}): ${message.text}`;
  });
  if (conversation.omittedCount > 0) {
    lines.unshift(
      `(${conversation.omittedCount} mensajes anteriores no copiados)`,
    );
  }
  if (lines.length === 0) {
    lines.push('(sin mensajes)');
  }
  return [`Chat del viaje denunciado. Motivo: ${reason}`, '', ...lines].join(
    '\n',
  );
}
