import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { DailyTripLimitError } from './errors/daily-trip-limit.error';
import { TripOverlapsError } from './errors/trip-overlaps.error';
import { findOverlap, ScheduledTrip } from './publishing-limits';
import { MAX_TRIPS_PER_DAY } from './trip-timing';

// El viaje que se quiere publicar o mover. excludeTripId: el propio viaje al
// editarlo, que no cuenta contra sí mismo
export interface TripSlot extends ScheduledTrip {
  driverId: string;
  excludeTripId?: string;
}

interface ScheduledRow {
  departureAt: Date;
  durationMin: number;
  maxDetourMin: number;
}

// Límites del calendario del conductor al publicar o mover un viaje: no
// cruzarse con otro de sus viajes activos y no pasar de MAX_TRIPS_PER_DAY
// viajes no cancelados en el mismo día (hora de Madrid)
@Injectable()
export class PublishingLimitsService {
  // En la transacción de quien publica o edita. Antes bloquea el calendario
  // del conductor hasta el final de la transacción: dos publicaciones a la vez
  // no pueden saltarse los límites. Es un bloqueo propio (advisory), no de
  // filas: no cambia el orden viaje → solicitud del resto de operaciones
  async assertCanSchedule(
    manager: EntityManager,
    slot: TripSlot,
  ): Promise<void> {
    await manager.query(
      "SELECT pg_advisory_xact_lock(hashtext('trip-schedule:' || $1))",
      [slot.driverId],
    );
    const excludeTripId = slot.excludeTripId ?? null;

    const [{ count }] = await manager.query<{ count: string }[]>(
      `SELECT count(*) AS count FROM trips
        WHERE driver_id = $1
          AND status <> 'cancelled'
          AND (departure_at AT TIME ZONE 'Europe/Madrid')::date
              = ($2::timestamptz AT TIME ZONE 'Europe/Madrid')::date
          AND id IS DISTINCT FROM $3::uuid`,
      [slot.driverId, slot.departureAt, excludeTripId],
    );
    if (Number(count) >= MAX_TRIPS_PER_DAY) {
      throw new DailyTripLimitError(MAX_TRIPS_PER_DAY);
    }

    // Solo los viajes de un día antes o después pueden cruzarse
    const scheduled = await manager.query<ScheduledRow[]>(
      `SELECT t.departure_at AS "departureAt",
              coalesce(r.duration_min, 0) AS "durationMin",
              t.max_detour_min AS "maxDetourMin"
         FROM trips t
         LEFT JOIN routes r ON r.trip_id = t.id
        WHERE t.driver_id = $1
          AND t.status IN ('published', 'confirmed', 'in_progress')
          AND t.departure_at BETWEEN $2::timestamptz - interval '1 day'
                                 AND $2::timestamptz + interval '1 day'
          AND t.id IS DISTINCT FROM $3::uuid`,
      [slot.driverId, slot.departureAt, excludeTripId],
    );
    const conflict = findOverlap(slot, scheduled);
    if (conflict !== undefined) {
      throw new TripOverlapsError(conflict.departureAt);
    }
  }
}
