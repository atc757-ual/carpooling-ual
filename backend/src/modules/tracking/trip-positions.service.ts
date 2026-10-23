import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { NotTripPassengerError } from '../requests/errors/not-trip-passenger.error';
import { RequestsService } from '../requests/requests.service';
import { Trip } from '../trips/entities/trip.entity';
import { NotTripDriverError } from '../trips/errors/not-trip-driver.error';
import { TripNotInProgressError } from '../trips/errors/trip-not-in-progress.error';
import { TripRoutesService } from '../trips/trip-routes.service';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import { TripPosition } from './entities/trip-position.entity';
import { PositionNotFoundError } from './errors/position-not-found.error';
import { PositionTooFrequentError } from './errors/position-too-frequent.error';

const SECOND_MS = 1000;

// Seguimiento real del viaje (RF-12: "estado actual del desplazamiento"):
// - el conductor envía su posición mientras el viaje está en curso; cada una
//   lleva lo que queda hasta el destino (OSRM, o estimado si no responde) y
//   genera el evento trip.position_updated para el Gemelo Digital (RNF-07)
// - la ven el conductor y sus pasajeros aceptados, nadie más
// - privacidad (RGPD, minimización): el recorrido solo se guarda mientras
//   dura el viaje; al finalizar o cancelarlo se borra
@Injectable()
export class TripPositionsService implements OnModuleInit {
  private readonly minIntervalSeconds: number;

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TripPosition)
    private readonly positionsRepository: Repository<TripPosition>,
    private readonly tripsService: TripsService,
    private readonly tripStatus: TripStatusService,
    private readonly tripRoutes: TripRoutesService,
    private readonly requestsService: RequestsService,
    private readonly eventsService: EventsService,
    configService: ConfigService,
  ) {
    this.minIntervalSeconds = configService.getOrThrow<number>(
      'positionMinIntervalSeconds',
    );
  }

  // Al finalizar o cancelar el viaje se borra su recorrido, en la misma
  // transacción (patrón observador: trips no conoce este módulo)
  onModuleInit(): void {
    this.tripStatus.onTripStatusChanged(async (manager, { trip, to }) => {
      if (to === 'finished' || to === 'cancelled') {
        await manager.delete(TripPosition, { tripId: trip.id });
      }
    });
  }

  // El conductor envía su posición. Lo que queda hasta el destino se calcula
  // ANTES de la transacción (sin bloquear el viaje mientras se espera a
  // OSRM); dentro, con el viaje bloqueado, se vuelven a comprobar las reglas
  async report(
    driverId: string,
    tripId: string,
    position: Point,
  ): Promise<TripPosition> {
    const { trip } = await this.tripsService.getById(tripId);
    this.assertCanReport(driverId, trip);
    const remaining = await this.tripRoutes.plan(position, trip.destination);

    return this.dataSource.transaction(async (manager) => {
      const locked = await this.tripStatus.lockTrip(manager, tripId);
      this.assertCanReport(driverId, locked);
      await this.assertNotTooFrequent(manager, tripId);
      const saved = await manager.save(
        manager.create(TripPosition, {
          tripId,
          position,
          remainingKm: remaining.distanceKm,
          remainingMin: remaining.durationMin,
          remainingSource: remaining.source,
        }),
      );
      await this.eventsService.record(manager, {
        type: 'trip.position_updated',
        sourceEntityId: tripId,
        payload: {
          position: saved.position,
          recordedAt: saved.recordedAt.toISOString(),
          remainingKm: saved.remainingKm,
          remainingMin: saved.remainingMin,
          remainingSource: saved.remainingSource,
        },
      });
      return saved;
    });
  }

  // La última posición del viaje: solo para su conductor y sus pasajeros
  // aceptados (es la ubicación de una persona)
  async getLatest(userId: string, tripId: string): Promise<TripPosition> {
    const { trip } = await this.tripsService.getById(tripId);
    const canSee =
      trip.driverId === userId ||
      (await this.requestsService.isAcceptedPassenger(tripId, userId));
    if (!canSee) {
      throw new NotTripPassengerError(tripId);
    }
    const latest = await this.positionsRepository.findOne({
      where: { tripId },
      order: { recordedAt: 'DESC' },
    });
    if (latest === null) {
      throw new PositionNotFoundError(tripId);
    }
    return latest;
  }

  private assertCanReport(driverId: string, trip: Trip): void {
    if (trip.driverId !== driverId) {
      throw new NotTripDriverError(trip.id);
    }
    if (trip.status !== 'in_progress') {
      throw new TripNotInProgressError(trip.id, trip.status);
    }
  }

  // Como mucho una posición cada POSITION_MIN_INTERVAL_SECONDS (DP-04). El
  // viaje está bloqueado: dos envíos simultáneos no pueden colarse los dos
  private async assertNotTooFrequent(
    manager: EntityManager,
    tripId: string,
  ): Promise<void> {
    const last = await manager.findOne(TripPosition, {
      where: { tripId },
      order: { recordedAt: 'DESC' },
    });
    const minIntervalMs = this.minIntervalSeconds * SECOND_MS;
    if (
      last !== null &&
      Date.now() - last.recordedAt.getTime() < minIntervalMs
    ) {
      throw new PositionTooFrequentError(this.minIntervalSeconds);
    }
  }
}
