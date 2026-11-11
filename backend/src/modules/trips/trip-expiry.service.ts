import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, LessThanOrEqual, Repository } from 'typeorm';
import { NotificationsService } from '../notifications/notifications.service';
import { Trip } from './entities/trip.entity';
import { MINUTE_MS, REQUEST_CUTOFF_MIN } from './trip-timing';
import { TripStatusService } from './trip-status.service';

// Al llegar el corte (10 min antes de la salida), un viaje sin ningún
// pasajero aceptado ya no puede tenerlos: se cierra como «Sin pasajeros»
// (expired), que no es una cancelación ni cuenta para la suspensión, y se
// avisa al conductor. Con pasajeros (confirmado) sigue su curso
@Injectable()
export class TripExpiryService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    private readonly tripStatus: TripStatusService,
    private readonly notifications: NotificationsService,
  ) {}

  // Devuelve cuántos viajes se han cerrado
  async expireUnfilledTrips(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() + REQUEST_CUTOFF_MIN * MINUTE_MS);
    const due = await this.tripsRepository.find({
      where: { status: 'published', departureAt: LessThanOrEqual(cutoff) },
      select: { id: true },
    });
    return due.reduce<Promise<number>>(async (previous, { id }) => {
      const expired = await previous;
      return (await this.expireOne(id)) ? expired + 1 : expired;
    }, Promise.resolve(0));
  }

  // Uno por transacción, con la fila bloqueada: si alguien lo cambió mientras
  // tanto (p. ej. lo canceló), se deja como está
  private expireOne(id: string): Promise<boolean> {
    return this.dataSource.transaction(async (manager) => {
      const trip = await this.tripStatus.lockTrip(manager, id);
      if (trip.status !== 'published') {
        return false;
      }
      await this.tripStatus.changeStatus(manager, trip, 'expired');
      await this.notifications.notify(manager, [trip.driverId], {
        type: 'trip_expired',
        tripId: trip.id,
      });
      return true;
    });
  }
}
