import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Incident } from './entities/incident.entity';
import { MessageAlreadyReportedError } from './errors/message-already-reported.error';
import { IncidentsService, IncidentView } from './incidents.service';

// Restricción UNIQUE de la denuncia (migración AddIncidentChatMessage)
const REPORT_UNIQUE_INDEX = 'incidents_chat_message_reporter_key';

// El mensaje denunciado, tal como lo da el chat (este módulo no lee sus
// tablas)
export interface ReportedMessage {
  id: string;
  tripId: string;
  driverId: string;
  authorName: string;
  authorRole: 'driver' | 'passenger';
  text: string;
  createdAt: Date;
}

const TIME_FORMAT = new Intl.DateTimeFormat('es-ES', {
  timeZone: 'Europe/Madrid',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

// Denuncia de un mensaje del chat del viaje: una incidencia para el
// administrador (CU-12) que, a diferencia de las del viaje en curso (RF-23),
// no cancela nada. La categoría es el papel de quien escribió el mensaje y la
// descripción lleva una copia del mensaje (se borra a los 30 días) y el motivo
@Injectable()
export class MessageReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly incidentsService: IncidentsService,
  ) {}

  async report(
    reporterId: string,
    message: ReportedMessage,
    reason: string,
  ): Promise<IncidentView> {
    try {
      const incident = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(Incident, {
            tripId: message.tripId,
            requestId: null,
            reporterId,
            chatMessageId: message.id,
            category: message.authorRole,
            description: describe(message, reason),
          }),
        );
        await this.incidentsService.recordReported(
          manager,
          created,
          message.driverId,
        );
        return created;
      });
      return await this.incidentsService.toView(incident);
    } catch (error) {
      if (isUniqueViolation(error, REPORT_UNIQUE_INDEX)) {
        throw new MessageAlreadyReportedError(message.id);
      }
      throw error;
    }
  }
}

// «Mensaje denunciado de Pía R. (pasajera) el 3 nov, 07:05: «…». Motivo: …»
export function describe(message: ReportedMessage, reason: string): string {
  const role = message.authorRole === 'driver' ? 'conductor' : 'pasajero';
  return `Mensaje del chat denunciado de ${message.authorName} (${role}), ${TIME_FORMAT.format(message.createdAt)}: «${message.text}». Motivo: ${reason}`;
}
