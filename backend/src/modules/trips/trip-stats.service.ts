import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { LateCancellation } from './entities/late-cancellation.entity';
import { Trip } from './entities/trip.entity';
import { DAY_MS, LATE_CANCELLATION_WINDOW_DAYS } from './trip-timing';

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
}
