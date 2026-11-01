import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, IsNull, MoreThan, Repository } from 'typeorm';
import { AuditService } from '../../audit/audit.service';
import { EventsService } from '../../events/events.service';
import {
  LateCancellation,
  LateCancellationRole,
} from './entities/late-cancellation.entity';
import { Trip } from './entities/trip.entity';
import { PublishingSuspendedError } from './errors/publishing-suspended.error';
import { UserNotSuspendedError } from './errors/user-not-suspended.error';
import {
  DAY_MS,
  LATE_CANCELLATION_WINDOW_DAYS,
  LATE_CANCELLATIONS_TO_SUSPEND,
  MINUTE_MS,
  PUBLISHING_SUSPENSION_DAYS,
  LATE_CANCELLATION_LEAD_MIN,
} from './trip-timing';

// Cancelaciones tardías del conductor en los últimos 30 días y, si las hay
// suficientes, hasta cuándo no puede publicar
export interface PublishingStatus {
  lateCancellations: number;
  publishingSuspendedUntil: Date | null;
}

// Lo mismo para el pasajero: hasta cuándo no puede pedir plaza
export interface RequestingStatus {
  lateCancellations: number;
  requestingSuspendedUntil: Date | null;
}

// Suspensiones en curso de un usuario, por papel (null si no tiene)
export interface UserSuspensions {
  driver: Date | null;
  passenger: Date | null;
}

// Un administrador levanta la suspensión de un papel con su motivo
export interface WaiveInput {
  adminId: string;
  userId: string;
  role: LateCancellationRole;
  reason: string;
}

// Cancelaciones tardías de un papel y hasta cuándo dura su suspensión
interface Suspension {
  lateCancellations: number;
  suspendedUntil: Date | null;
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

// Las de los 60 días anteriores bastan: la suspensión mira la última y los
// 30 días anteriores a ella
function suspensionLookback(now: Date): Date {
  return new Date(now.getTime() - 2 * LATE_CANCELLATION_WINDOW_DAYS * DAY_MS);
}

// Fechas de las cancelaciones que cuentan (sin perdonar), de la más reciente
// a la más antigua
async function loadDates(
  manager: EntityManager,
  userId: string,
  role: LateCancellationRole,
  now: Date,
): Promise<Date[]> {
  const rows = await manager.find(LateCancellation, {
    where: {
      userId,
      role,
      waivedAt: IsNull(),
      cancelledAt: MoreThan(suspensionLookback(now)),
    },
    order: { cancelledAt: 'DESC' },
    select: { cancelledAt: true },
  });
  return rows.map(({ cancelledAt }) => cancelledAt);
}

// Agrupa por usuario y papel (filas de la más reciente a la más antigua) y se
// queda con las suspensiones en curso
export function toSuspensions(
  rows: readonly Pick<LateCancellation, 'userId' | 'role' | 'cancelledAt'>[],
  now: Date,
): Map<string, UserSuspensions> {
  const dates = new Map<string, Date[]>();
  for (const { userId, role, cancelledAt } of rows) {
    const key = userId + ':' + role;
    dates.set(key, [...(dates.get(key) ?? []), cancelledAt]);
  }
  const suspensions = new Map<string, UserSuspensions>();
  for (const [key, cancelledAt] of dates) {
    const end = findSuspensionEnd(cancelledAt, now);
    if (end !== null) {
      const [userId, role] = key.split(':') as [string, LateCancellationRole];
      const current = suspensions.get(userId) ?? {
        driver: null,
        passenger: null,
      };
      suspensions.set(userId, { ...current, [role]: end });
    }
  }
  return suspensions;
}

function minutesToDeparture(trip: Trip, now: Date): number {
  return (trip.departureAt.getTime() - now.getTime()) / MINUTE_MS;
}

// Si cancelar este viaje ahora es tardío: tiene pasajeros aceptados
// (confirmado) y faltan menos de 30 minutos para la salida
export function isLateDriverCancellation(trip: Trip, now: Date): boolean {
  return (
    trip.status === 'confirmed' &&
    minutesToDeparture(trip, now) < LATE_CANCELLATION_LEAD_MIN
  );
}

// Si el pasajero suelta tarde su plaza: la tenía aceptada y faltan menos de
// 30 minutos para la salida (la misma regla que el conductor). Cancelar una
// solicitud pendiente nunca es tardío
export function isLatePassengerCancellation(
  trip: Trip,
  wasAccepted: boolean,
  now: Date,
): boolean {
  return (
    wasAccepted && minutesToDeparture(trip, now) < LATE_CANCELLATION_LEAD_MIN
  );
}

// Cancelaciones tardías (RF de cancelación) del conductor y del pasajero: las
// registran los módulos de viajes y de solicitudes en la misma transacción que
// la cancelación, con su evento para el Gemelo Digital, y deciden si el
// conductor puede publicar y el pasajero pedir plaza
@Injectable()
export class LateCancellationsService {
  constructor(
    @InjectRepository(LateCancellation)
    private readonly lateCancellationsRepository: Repository<LateCancellation>,
    private readonly events: EventsService,
    private readonly audit: AuditService,
  ) {}

  recordDriverCancellation(manager: EntityManager, trip: Trip): Promise<void> {
    return this.record(manager, trip, trip.driverId, 'driver');
  }

  recordPassengerCancellation(
    manager: EntityManager,
    trip: Trip,
    passengerId: string,
  ): Promise<void> {
    return this.record(manager, trip, passengerId, 'passenger');
  }

  async getPublishingStatus(
    driverId: string,
    now = new Date(),
  ): Promise<PublishingStatus> {
    const { lateCancellations, suspendedUntil } = await this.getSuspension(
      driverId,
      'driver',
      now,
    );
    return { lateCancellations, publishingSuspendedUntil: suspendedUntil };
  }

  async getRequestingStatus(
    passengerId: string,
    now = new Date(),
  ): Promise<RequestingStatus> {
    const { lateCancellations, suspendedUntil } = await this.getSuspension(
      passengerId,
      'passenger',
      now,
    );
    return { lateCancellations, requestingSuspendedUntil: suspendedUntil };
  }

  async assertCanPublish(driverId: string): Promise<void> {
    const { publishingSuspendedUntil } =
      await this.getPublishingStatus(driverId);
    if (publishingSuspendedUntil !== null) {
      throw new PublishingSuspendedError(publishingSuspendedUntil);
    }
  }

  // Suspensiones en curso de varios usuarios (o de todos, sin ids) en una
  // sola consulta, para el panel. Solo salen los que tienen alguna
  async findSuspensions(
    userIds?: readonly string[],
    now = new Date(),
  ): Promise<Map<string, UserSuspensions>> {
    if (userIds?.length === 0) {
      return new Map();
    }
    const rows = await this.lateCancellationsRepository.find({
      where: {
        ...(userIds === undefined ? {} : { userId: In(userIds) }),
        waivedAt: IsNull(),
        cancelledAt: MoreThan(suspensionLookback(now)),
      },
      order: { cancelledAt: 'DESC' },
      select: { userId: true, role: true, cancelledAt: true },
    });
    return toSuspensions(rows, now);
  }

  // Levanta la suspensión de un papel antes de tiempo: perdona sus
  // cancelaciones tardías pendientes, con su evento y su auditoría en la misma
  // transacción. Devuelve cuántas perdonó
  async waive(input: WaiveInput, now = new Date()): Promise<number> {
    const { adminId, userId, role, reason } = input;
    return this.lateCancellationsRepository.manager.transaction(
      async (manager) => {
        const dates = await loadDates(manager, userId, role, now);
        if (findSuspensionEnd(dates, now) === null) {
          throw new UserNotSuspendedError(userId, role);
        }
        const { affected } = await manager.update(
          LateCancellation,
          { userId, role, waivedAt: IsNull() },
          { waivedAt: now, waivedBy: adminId, waivedReason: reason },
        );
        const waived = affected ?? 0;
        await this.events.record(manager, {
          type: 'late_cancellation.waived',
          sourceEntityId: userId,
          payload: { adminId, userId, role, waived },
        });
        await this.audit.record(manager, {
          adminId,
          action: 'suspension.lifted',
          targetUserId: userId,
          details: { role, waived },
          reason,
        });
        return waived;
      },
    );
  }

  // El mismo evento para los dos papeles: el payload dice quién canceló
  private async record(
    manager: EntityManager,
    trip: Trip,
    userId: string,
    role: LateCancellationRole,
  ): Promise<void> {
    const saved = await manager.save(
      manager.create(LateCancellation, { userId, tripId: trip.id, role }),
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

  private async getSuspension(
    userId: string,
    role: LateCancellationRole,
    now: Date,
  ): Promise<Suspension> {
    const dates = await loadDates(
      this.lateCancellationsRepository.manager,
      userId,
      role,
      now,
    );
    const windowStart = now.getTime() - LATE_CANCELLATION_WINDOW_DAYS * DAY_MS;
    return {
      lateCancellations: dates.filter((date) => date.getTime() > windowStart)
        .length,
      suspendedUntil: findSuspensionEnd(dates, now),
    };
  }
}
