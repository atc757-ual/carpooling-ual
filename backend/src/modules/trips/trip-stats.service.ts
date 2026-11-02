import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, MoreThan, Repository } from 'typeorm';
import { LateCancellation } from './entities/late-cancellation.entity';
import { Trip } from './entities/trip.entity';
import { Page, PageRequest } from '../../shared/pagination/page';
import { TripNotFoundError } from './errors/trip-not-found.error';
import { DAY_MS, LATE_CANCELLATION_WINDOW_DAYS } from './trip-timing';
import type { TripStatus } from './trip-status';

// Hora del campus: «hoy» empieza a medianoche en Almería
export const CAMPUS_TIME_ZONE = 'Europe/Madrid';

// Viajes que aún cuentan sus plazas (no han terminado ni se han cancelado)
const ACTIVE_TRIP_STATUSES = ['published', 'confirmed', 'in_progress'] as const;

// Filtros de la lista del panel. Las fechas, YYYY-MM-DD en la hora del
// campus (los dos días incluidos); driverIds, los conductores posibles
export interface AdminTripFilter {
  status?: TripStatus;
  from?: string;
  to?: string;
  driverIds?: readonly string[];
}

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
  // siguen activos. Una sola consulta, con el manager de quien llama si va en
  // su transacción
  async overview(
    manager: EntityManager = this.tripsRepository.manager,
  ): Promise<TripOverview> {
    const [row]: Record<keyof TripOverview, string | null>[] =
      await manager.query(
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

  // Viajes para el panel, la salida más reciente primero
  async listForAdmin(
    filter: AdminTripFilter,
    page: PageRequest,
  ): Promise<Page<Trip>> {
    if (filter.driverIds?.length === 0) {
      return { items: [], total: 0 };
    }
    const query = this.tripsRepository
      .createQueryBuilder('trip')
      .orderBy('trip.departureAt', 'DESC')
      .addOrderBy('trip.id', 'ASC')
      .skip(page.offset)
      .take(page.limit);
    if (filter.status !== undefined) {
      query.andWhere('trip.status = :status', { status: filter.status });
    }
    if (filter.from !== undefined) {
      query.andWhere(
        'trip.departureAt >= (CAST(:from AS timestamp) AT TIME ZONE :zone)',
        { from: filter.from, zone: CAMPUS_TIME_ZONE },
      );
    }
    if (filter.to !== undefined) {
      query.andWhere(
        "trip.departureAt < ((CAST(:to AS timestamp) + interval '1 day') AT TIME ZONE :zone)",
        { to: filter.to, zone: CAMPUS_TIME_ZONE },
      );
    }
    if (filter.driverIds !== undefined) {
      query.andWhere('trip.driverId IN (:...driverIds)', {
        driverIds: filter.driverIds,
      });
    }
    const [items, total] = await query.getManyAndCount();
    return { items, total };
  }

  // Lanza TripNotFoundError si no existe
  async get(tripId: string): Promise<Trip> {
    const trip = await this.tripsRepository.findOneBy({ id: tripId });
    if (trip === null) {
      throw new TripNotFoundError(tripId);
    }
    return trip;
  }
}
