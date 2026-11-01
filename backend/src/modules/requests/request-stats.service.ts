import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SeatRequest } from './entities/seat-request.entity';

// Recuentos de solicitudes para el panel de administración: una consulta para
// toda una página de usuarios
@Injectable()
export class RequestStatsService {
  constructor(
    @InjectRepository(SeatRequest)
    private readonly requestsRepository: Repository<SeatRequest>,
  ) {}

  // Viajes con plaza aceptada de cada pasajero
  async countAcceptedByPassengers(
    passengerIds: readonly string[],
  ): Promise<Map<string, number>> {
    if (passengerIds.length === 0) {
      return new Map();
    }
    const rows: { passengerId: string; total: string }[] =
      await this.requestsRepository
        .createQueryBuilder('request')
        .select('request.passengerId', 'passengerId')
        .addSelect('COUNT(*)', 'total')
        .where('request.passengerId IN (:...passengerIds)', { passengerIds })
        .andWhere("request.status = 'accepted'")
        .groupBy('request.passengerId')
        .getRawMany();
    return new Map(rows.map((row) => [row.passengerId, Number(row.total)]));
  }
}
