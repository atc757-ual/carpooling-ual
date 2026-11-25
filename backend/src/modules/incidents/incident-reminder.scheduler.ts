import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DataSource, LessThanOrEqual } from 'typeorm';
import { TripsService } from '../trips/trips.service';
import { Incident } from './entities/incident.entity';
import { IncidentNoticesService } from './incident-notices.service';

// Cuánto puede estar registrada una incidencia sin que nadie la coja antes de
// recordarlo a los administradores
export const UNTAKEN_INCIDENT_REMINDER_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

// Recordatorio de las incidencias sin atender (RF-19, CU-12): cada 15 min,
// las registradas hace 24 h o más que nadie ha cogido (también las que se
// soltaron) avisan a los administradores que pueden gestionarlas, una sola
// vez por incidencia
@Injectable()
export class IncidentReminderScheduler {
  private readonly logger = new Logger(IncidentReminderScheduler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly tripsService: TripsService,
    private readonly notices: IncidentNoticesService,
  ) {}

  @Cron('*/15 * * * *')
  async handleCron(): Promise<void> {
    const reminded = await this.remindUntaken();
    if (reminded > 0) {
      this.logger.log(
        `Recordadas ${reminded} incidencias sin atender (${UNTAKEN_INCIDENT_REMINDER_HOURS} h)`,
      );
    }
  }

  // Devuelve de cuántas se ha avisado
  async remindUntaken(now = new Date()): Promise<number> {
    const limit = new Date(
      now.getTime() - UNTAKEN_INCIDENT_REMINDER_HOURS * HOUR_MS,
    );
    return this.dataSource.transaction(async (manager) => {
      const due = await manager.find(Incident, {
        where: { status: 'open', createdAt: LessThanOrEqual(limit) },
        order: { createdAt: 'ASC' },
      });
      const trips = await this.tripsService.getByIds(
        due.map(({ tripId }) => tripId),
      );
      // Una tras otra en la misma transacción (comparten el manager)
      return due.reduce<Promise<number>>(async (previous, incident) => {
        const reminded = await previous;
        const driverId = trips.get(incident.tripId)?.driverId ?? '';
        return (await this.notices.remindUntaken(manager, incident, driverId))
          ? reminded + 1
          : reminded;
      }, Promise.resolve(0));
    });
  }
}
