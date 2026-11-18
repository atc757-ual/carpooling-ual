import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { VehiclesService } from '../users/vehicles.service';
import { AUTO_FINISH_AFTER_ARRIVAL_MIN } from './trip-timing';
import { TripStatusService } from './trip-status.service';

// Cierre automático (decidido con el autor el 17/11/2026): un viaje en curso
// que nadie termina pasa a finalizado 1 h después de su llegada estimada, con
// la marca de que lo cerró el sistema (finished_by = system). No hay estado
// nuevo. Las plazas que siguen abiertas las cierra el módulo de solicitudes al
// enterarse del cambio (observador), y se avisa al conductor
@Injectable()
export class TripAutoFinishService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tripStatus: TripStatusService,
    private readonly vehiclesService: VehiclesService,
    private readonly notifications: NotificationsService,
  ) {}

  // Devuelve cuántos viajes se han cerrado
  async finishAbandonedTrips(now = new Date()): Promise<number> {
    const due = await this.findDue(now);
    return due.reduce<Promise<number>>(async (previous, id) => {
      const finished = await previous;
      return (await this.finishOne(id)) ? finished + 1 : finished;
    }, Promise.resolve(0));
  }

  // La llegada estimada: la salida (o el inicio, si fue más tarde) más la
  // duración de la ruta guardada (sin ruta, la salida)
  private async findDue(now: Date): Promise<string[]> {
    const rows = await this.dataSource.query<{ id: string }[]>(
      `SELECT t.id
         FROM trips t
         LEFT JOIN routes r ON r.trip_id = t.id
        WHERE t.status = 'in_progress'
          AND GREATEST(t.departure_at, COALESCE(t.started_at, t.departure_at))
              + make_interval(mins => COALESCE(r.duration_min, 0) + $2)
              <= $1
        ORDER BY t.id`,
      [now, AUTO_FINISH_AFTER_ARRIVAL_MIN],
    );
    return rows.map(({ id }) => id);
  }

  // Uno por transacción, con la fila bloqueada: si el conductor lo terminó
  // mientras tanto, se deja como está
  private finishOne(id: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const trip = await this.tripStatus.lockTrip(manager, id);
      if (trip.status !== 'in_progress') {
        return false;
      }
      trip.finishedBy = 'system';
      trip.finishDistanceM = null;
      await this.tripStatus.changeStatus(manager, trip, 'finished');
      await this.vehiclesService.markAvailable(manager, trip.vehicleId);
      await this.notifications.notify(manager, [trip.driverId], {
        type: 'trip_auto_finished',
        tripId: trip.id,
      });
      return true;
    });
  }
}
