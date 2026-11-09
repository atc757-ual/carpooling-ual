import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, In } from 'typeorm';
import { TripLookupService } from '../trips/trip-lookup.service';
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
    private readonly tripLookup: TripLookupService,
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
      // Las pendientes cuyo viaje sale en menos de 30 minutos. La salida la
      // da trips (este módulo no consulta sus tablas); después se bloquean
      // las que tocan, por si alguien las respondió mientras tanto
      const pending = await manager.find(SeatRequest, {
        where: { status: 'pending' },
        select: { id: true, tripId: true },
      });
      const tripsById = await this.tripLookup.findByIds(
        manager,
        pending.map(({ tripId }) => tripId),
      );
      const dueIds = pending
        .filter(({ tripId }) => {
          const trip = tripsById.get(tripId);
          return trip !== undefined && trip.departureAt <= threshold;
        })
        .map(({ id }) => id);
      if (dueIds.length === 0) {
        return 0;
      }
      const pendingRequests = await manager.find(SeatRequest, {
        where: { id: In(dueIds), status: 'pending' },
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (pendingRequests.length === 0) {
        return 0;
      }

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
