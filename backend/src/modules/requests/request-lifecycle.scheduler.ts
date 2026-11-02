import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In } from 'typeorm';
import { Trip } from '../trips/entities/trip.entity';
import { MINUTE_MS, REQUEST_RESPONSE_LEAD_MIN } from '../trips/trip-timing';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { assertRequestTransition } from './request-status';

@Injectable()
export class RequestLifecycleScheduler {
  private readonly logger = new Logger(RequestLifecycleScheduler.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly changes: RequestChangesRecorder,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron(): Promise<void> {
    const expiredCount = await this.expirePendingRequests();
    if (expiredCount > 0) {
      this.logger.log(
        `Expiradas ${expiredCount} solicitudes pendientes por falta de respuesta a 30m`,
      );
    }
  }

  // Expirar solicitudes pendientes cuando faltan menos de REQUEST_RESPONSE_LEAD_MIN (30 min)
  // para la salida del viaje
  async expirePendingRequests(now = new Date()): Promise<number> {
    const threshold = new Date(
      now.getTime() + REQUEST_RESPONSE_LEAD_MIN * MINUTE_MS,
    );

    return this.dataSource.transaction(async (manager) => {
      // Buscar solicitudes pendientes cuyos viajes salgan en menos de 30 minutos
      const pendingRequests = await manager
        .createQueryBuilder(SeatRequest, 'request')
        .innerJoin(Trip, 'trip', 'trip.id = request.trip_id')
        .where('request.status = :status', { status: 'pending' })
        .andWhere('trip.departure_at <= :threshold', { threshold })
        .setLock('pessimistic_write')
        .getMany();

      if (pendingRequests.length === 0) {
        return 0;
      }

      const tripIds = [...new Set(pendingRequests.map(({ tripId }) => tripId))];
      const trips = await manager.find(Trip, { where: { id: In(tripIds) } });
      const tripsById = new Map(trips.map((trip) => [trip.id, trip]));

      for (const request of pendingRequests) {
        assertRequestTransition(request.status, 'expired');
        request.status = 'expired';
        request.rejectionReason = 'expired';
        request.answeredAt = now;
      }

      const saved = await manager.save(pendingRequests);
      for (const request of saved) {
        const trip = tripsById.get(request.tripId);
        if (trip) {
          const recordPromise = this.changes.record(
            manager,
            'request.expired',
            request,
            trip,
          );
          await recordPromise; // NOSONAR: la conexión transaccional requiere escrituras secuenciales
        }
      }

      return saved.length;
    });
  }
}
