import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { LateCancellation } from './entities/late-cancellation.entity';
import { Trip } from './entities/trip.entity';
import { DAY_MS, LATE_CANCELLATION_WINDOW_DAYS } from './trip-timing';

// Hora del campus: «hoy» empieza a medianoche en Almería
export const CAMPUS_TIME_ZONE = 'Europe/Madrid';

// Viajes que aún cuentan sus plazas (no han terminado ni se han cancelado)
const ACTIVE_TRIP_STATUSES = ['published', 'confirmed', 'in_progress'] as const;

export interface TripOverview {
  publishedToday: number;
  inProgress: number;
  seatsOffered: number;
  seatsTaken: number;
}

// Lecturas de viajes para el panel de administración: recuentos para toda una
// página de usuarios y el historial reciente de uno
@Injectable()
export class TripStatsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    @InjectRepository(LateCancellation)
    private readonly lateCancellationsRepository: Repository<LateCancellation>,
  ) {}

  // Viajes publicados por cada conductor, sin contar los cancelados
  async countByDrivers(
    driverIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (driverIds.length === 0) {
      return new Map();
    }
    const rows: { driverId: string; total: string }[] =
      await this.tripsRepository
        .createQueryBuilder('trip')
        .select('trip.driverId', 'driverId')
        .addSelect('COUNT(*)', 'total')
        .where('trip.driverId IN (:...driverIds)', { driverIds })
        .andWhere("trip.status <> 'cancelled'")
        .groupBy('trip.driverId')
        .getRawMany();
    return new Map(rows.map((row) => [row.driverId, Number(row.total)]));
  }

  // Los últimos viajes del conductor, del más reciente al más antiguo
  recentByDriver(driverId: string, limit: number): Promise<Trip[]> {
    return this.tripsRepository.find({
      where: { driverId },
      order: { departureAt: 'DESC', id: 'ASC' },
      take: limit,
    });
  }

  // Ids de todos los viajes del conductor (p. ej. para sus incidencias)
  async idsByDriver(driverId: string): Promise<string[]> {
    const trips = await this.tripsRepository.find({
      where: { driverId },
      select: { id: true },
    });
    return trips.map(({ id }) => id);
  }

  // Cancelaciones tardías del usuario en los últimos 30 días, perdonadas o
  // no, de la más reciente a la más antigua
  recentLateCancellations(
    userId: string,
    now = new Date(),
  ): Promise<LateCancellation[]> {
    const since = new Date(
      now.getTime() - LATE_CANCELLATION_WINDOW_DAYS * DAY_MS,
    );
    return this.lateCancellationsRepository.find({
      where: { userId, cancelledAt: MoreThan(since) },
      order: { cancelledAt: 'DESC', id: 'ASC' },
    });
  }

  // Resumen en vivo para el panel: viajes publicados hoy (en la hora del
  // campus), viajes en curso y plazas ofrecidas y ocupadas de los viajes que
  // siguen activos. Una sola consulta
  async overview(): Promise<TripOverview> {
    const [row]: Record<keyof TripOverview, string | null>[] =
      await this.tripsRepository.query(
        `SELECT
           count(*) FILTER (
             WHERE created_at >= date_trunc('day', now() AT TIME ZONE $1) AT TIME ZONE $1
           ) AS "publishedToday",
           count(*) FILTER (WHERE status = 'in_progress') AS "inProgress",
           coalesce(sum(offered_seats) FILTER (WHERE status IN ($2, $3, $4)), 0) AS "seatsOffered",
           coalesce(sum(offered_seats - available_seats)
             FILTER (WHERE status IN ($2, $3, $4)), 0) AS "seatsTaken"
         FROM trips`,
        [CAMPUS_TIME_ZONE, ...ACTIVE_TRIP_STATUSES],
      );
    return {
      publishedToday: Number(row.publishedToday ?? 0),
      inProgress: Number(row.inProgress ?? 0),
      seatsOffered: Number(row.seatsOffered ?? 0),
      seatsTaken: Number(row.seatsTaken ?? 0),
    };
  }
}
