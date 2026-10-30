import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { LateCancellation } from './entities/late-cancellation.entity';
import { Trip } from './entities/trip.entity';
import { PublishingSuspendedError } from './errors/publishing-suspended.error';
import {
  DAY_MS,
  LATE_CANCELLATION_WINDOW_DAYS,
  LATE_CANCELLATIONS_TO_SUSPEND,
  MINUTE_MS,
  PUBLISHING_SUSPENSION_DAYS,
  START_WINDOW_MIN,
} from './trip-timing';

// Cancelaciones tardías del conductor en los últimos 30 días y, si las hay
// suficientes, hasta cuándo no puede publicar
export interface PublishingStatus {
  lateCancellations: number;
  publishingSuspendedUntil: Date | null;
}

// Hasta cuándo no puede publicar quien canceló tarde en estas fechas (de la
// más reciente a la más antigua), o null. Cuenta la última y las de los 30
// días anteriores a ella: con 3, son 7 días desde la última. Pura, para
// probarla sin base de datos
export function findSuspensionEnd(
  cancelledAt: readonly Date[],
  now: Date,
): Date | null {
  const [latest] = cancelledAt;
  if (latest === undefined) {
    return null;
  }
  const windowStart = latest.getTime() - LATE_CANCELLATION_WINDOW_DAYS * DAY_MS;
  const inWindow = cancelledAt.filter(
    (date) => date.getTime() > windowStart,
  ).length;
  if (inWindow < LATE_CANCELLATIONS_TO_SUSPEND) {
    return null;
  }
  const end = new Date(latest.getTime() + PUBLISHING_SUSPENSION_DAYS * DAY_MS);
  return end > now ? end : null;
}

// Si cancelar este viaje ahora es tardío: tiene pasajeros aceptados
// (confirmado) y faltan menos de 30 minutos para la salida
export function isLateDriverCancellation(trip: Trip, now: Date): boolean {
  const minutesToDeparture =
    (trip.departureAt.getTime() - now.getTime()) / MINUTE_MS;
  return trip.status === 'confirmed' && minutesToDeparture < START_WINDOW_MIN;
}

// Cancelaciones tardías (RF de cancelación): las registra el módulo de viajes
// en la misma transacción que la cancelación, con su evento para el Gemelo
// Digital, y decide si el conductor puede publicar
@Injectable()
export class LateCancellationsService {
  constructor(
    @InjectRepository(LateCancellation)
    private readonly lateCancellationsRepository: Repository<LateCancellation>,
    private readonly events: EventsService,
  ) {}

  async recordDriverCancellation(
    manager: EntityManager,
    trip: Trip,
  ): Promise<void> {
    const saved = await manager.save(
      manager.create(LateCancellation, {
        userId: trip.driverId,
        tripId: trip.id,
        role: 'driver',
      }),
    );
    await this.events.record(manager, {
      type: 'trip.cancelled_late',
      sourceEntityId: trip.id,
      payload: {
        userId: saved.userId,
        tripId: saved.tripId,
        role: saved.role,
        cancelledAt: saved.cancelledAt.toISOString(),
      },
    });
  }

  async getPublishingStatus(
    driverId: string,
    now = new Date(),
  ): Promise<PublishingStatus> {
    // Las de los 60 días anteriores bastan: la suspensión mira la última y
    // los 30 días anteriores a ella
    const since = new Date(
      now.getTime() - 2 * LATE_CANCELLATION_WINDOW_DAYS * DAY_MS,
    );
    const rows = await this.lateCancellationsRepository.find({
      where: { userId: driverId, role: 'driver', cancelledAt: MoreThan(since) },
      order: { cancelledAt: 'DESC' },
      select: { cancelledAt: true },
    });
    const dates = rows.map(({ cancelledAt }) => cancelledAt);
    const windowStart = now.getTime() - LATE_CANCELLATION_WINDOW_DAYS * DAY_MS;
    return {
      lateCancellations: dates.filter((date) => date.getTime() > windowStart)
        .length,
      publishingSuspendedUntil: findSuspensionEnd(dates, now),
    };
  }

  async assertCanPublish(driverId: string): Promise<void> {
    const { publishingSuspendedUntil } =
      await this.getPublishingStatus(driverId);
    if (publishingSuspendedUntil !== null) {
      throw new PublishingSuspendedError(publishingSuspendedUntil);
    }
  }
}
