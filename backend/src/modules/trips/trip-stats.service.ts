import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip } from './entities/trip.entity';

// Recuentos de viajes para el panel de administración: una consulta para
// toda una página de usuarios
@Injectable()
export class TripStatsService {
  constructor(
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
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
}
