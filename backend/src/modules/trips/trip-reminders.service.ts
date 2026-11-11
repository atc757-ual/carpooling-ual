import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, DataSource, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Trip } from './entities/trip.entity';
import { MINUTE_MS, UNSTARTED_TRIP_CANCEL_WINDOW_MIN } from './trip-timing';

// Recordatorio al conductor de un viaje con pasajeros (confirmado) que, a la
// hora de salida, aún no ha iniciado: le quedan 10 min antes de que se cancele
// solo (con penalización). Un aviso por viaje, una sola vez
@Injectable()
export class TripRemindersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    private readonly notifications: NotificationsService,
  ) {}

  // Devuelve a cuántos conductores se ha recordado
  async remindUnstartedTrips(now = new Date()): Promise<number> {
    const since = new Date(
      now.getTime() - UNSTARTED_TRIP_CANCEL_WINDOW_MIN * MINUTE_MS,
    );
    const due = await this.tripsRepository.find({
      where: { status: 'confirmed', departureAt: Between(since, now) },
      select: { id: true, driverId: true },
    });
    if (due.length === 0) {
      return 0;
    }
    return this.dataSource.transaction(async (manager) => {
      return this.notifications.notifyTripDriversOnce(
        manager,
        due,
        'trip_start_reminder',
      );
    });
  }
}
