import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { SeatRequest } from './entities/seat-request.entity';

export interface TripRequestCounts {
  pending: number;
  accepted: number;
}

// Lecturas de solicitudes para el panel de administración: recuentos para
// toda una página de usuarios y el historial reciente de uno
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

  // Las últimas solicitudes del pasajero, de la más reciente a la más antigua
  recentByPassenger(
    passengerId: string,
    limit: number,
  ): Promise<SeatRequest[]> {
    return this.requestsRepository.find({
      where: { passengerId },
      order: { requestedAt: 'DESC', id: 'ASC' },
      take: limit,
    });
  }

  // Solicitudes que esperan la respuesta del conductor (con el manager de
  // quien llama si va en su transacción)
  countPending(
    manager: EntityManager = this.requestsRepository.manager,
  ): Promise<number> {
    return manager.countBy(SeatRequest, { status: 'pending' });
  }

  // Solicitudes pendientes y aceptadas de cada viaje
  async countByTrips(
    tripIds: readonly string[],
  ): Promise<Map<string, TripRequestCounts>> {
    if (tripIds.length === 0) {
      return new Map();
    }
    const rows: { tripId: string; pending: string; accepted: string }[] =
      await this.requestsRepository
        .createQueryBuilder('request')
        .select('request.tripId', 'tripId')
        .addSelect(
          "COUNT(*) FILTER (WHERE request.status = 'pending')",
          'pending',
        )
        .addSelect(
          "COUNT(*) FILTER (WHERE request.status = 'accepted')",
          'accepted',
        )
        .where('request.tripId IN (:...tripIds)', { tripIds })
        .groupBy('request.tripId')
        .getRawMany();
    return new Map(
      rows.map((row) => [
        row.tripId,
        { pending: Number(row.pending), accepted: Number(row.accepted) },
      ]),
    );
  }

  // Todas las solicitudes de un viaje: las prioritarias primero (RF-24) y
  // después por llegada
  byTrip(tripId: string): Promise<SeatRequest[]> {
    return this.requestsRepository.find({
      where: { tripId },
      order: { isPriority: 'DESC', requestedAt: 'ASC', id: 'ASC' },
    });
  }
}
