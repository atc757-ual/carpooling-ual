import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import { Trip } from './entities/trip.entity';
import { DepartureInThePastError } from './errors/departure-in-the-past.error';
import { DriverNotReadyError } from './errors/driver-not-ready.error';
import { NotTripDriverError } from './errors/not-trip-driver.error';
import { SeatsExceedCapacityError } from './errors/seats-exceed-capacity.error';
import { TripAlreadyStartedError } from './errors/trip-already-started.error';
import { TripNotEditableError } from './errors/trip-not-editable.error';
import { TripNotFoundError } from './errors/trip-not-found.error';
import { assertTransition } from './trip-status';

export interface TripInput {
  vehicleId: string;
  origin: Point;
  destination: Point;
  departureAt: Date;
  offeredSeats: number;
  maxDetourMin?: number;
}

// Modificación parcial: solo los campos que cambian
export type TripChanges = Partial<TripInput>;

// Un viaje con el nombre de su conductor (lo que ve un pasajero)
export interface TripView {
  trip: Trip;
  driverName: string;
}

const DEFAULT_MAX_DETOUR_MIN = 10;

// Viajes (RF-04, RF-05). Cada cambio de estado se guarda junto con su evento
// para el Gemelo Digital en una misma transacción (outbox, RNF-08)
@Injectable()
export class TripsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService,
    private readonly eventsService: EventsService,
  ) {}

  // RF-04: publicar un viaje. Antes, RF-21: el conductor debe estar listo
  async publish(driverId: string, input: TripInput): Promise<TripView> {
    const readiness = await this.usersService.getDriverReadiness(driverId);
    if (!readiness.isReady) {
      throw new DriverNotReadyError(readiness);
    }
    await this.assertValidTrip(driverId, input);

    const trip = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Trip, {
          ...input,
          driverId,
          maxDetourMin: input.maxDetourMin ?? DEFAULT_MAX_DETOUR_MIN,
          availableSeats: input.offeredSeats,
        }),
      );
      await this.recordEvent(manager, 'trip.published', saved);
      return saved;
    });
    return this.toView(trip);
  }

  // Cualquier usuario autenticado puede ver un viaje (los pasajeros los
  // encuentran al buscar): se muestra el nombre del conductor, no sus datos
  async getById(tripId: string): Promise<TripView> {
    const trip = await this.tripsRepository.findOneBy({ id: tripId });
    if (trip === null) {
      throw new TripNotFoundError(tripId);
    }
    return this.toView(trip);
  }

  // Viajes del conductor, del de salida más próxima al más lejano
  async listByDriver(
    driverId: string,
    page: PageRequest,
  ): Promise<Page<TripView>> {
    const [trips, total] = await this.tripsRepository.findAndCount({
      where: { driverId },
      order: { departureAt: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    const { name } = await this.usersService.getSummary(driverId);
    return {
      items: trips.map((trip) => ({ trip, driverName: name })),
      total,
    };
  }

  // RF-05: modificar, solo su conductor y solo mientras está publicado (aún
  // sin pasajeros aceptados, por eso las plazas disponibles = las ofertadas)
  async update(
    driverId: string,
    tripId: string,
    changes: TripChanges,
  ): Promise<TripView> {
    const trip = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockOwnTrip(manager, driverId, tripId);
      if (current.status !== 'published') {
        throw new TripNotEditableError(current.id, current.status);
      }
      await this.assertValidTrip(driverId, { ...current, ...changes });

      Object.assign(current, changes);
      current.availableSeats = current.offeredSeats;
      const updated = await manager.save(current);
      await this.recordEvent(manager, 'trip.updated', updated);
      return updated;
    });
    return this.toView(trip);
  }

  // RF-05: cancelar antes del inicio. Durante el viaje exige una incidencia
  // (RF-23), que llegará con su propio flujo
  async cancel(driverId: string, tripId: string): Promise<TripView> {
    const trip = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockOwnTrip(manager, driverId, tripId);
      if (current.status === 'in_progress') {
        throw new TripAlreadyStartedError(current.id);
      }
      assertTransition(current.status, 'cancelled');

      current.status = 'cancelled';
      const cancelled = await manager.save(current);
      await this.recordEvent(manager, 'trip.cancelled', cancelled);
      return cancelled;
    });
    return this.toView(trip);
  }

  // El viaje con el nombre de su conductor
  private async toView(trip: Trip): Promise<TripView> {
    const { name } = await this.usersService.getSummary(trip.driverId);
    return { trip, driverName: name };
  }

  // El viaje bloqueado (FOR UPDATE) hasta el final de la transacción, para
  // que dos cambios simultáneos no lo dejen incoherente
  private async lockOwnTrip(
    manager: EntityManager,
    driverId: string,
    tripId: string,
  ): Promise<Trip> {
    const trip = await manager.findOne(Trip, {
      where: { id: tripId },
      lock: { mode: 'pessimistic_write' },
    });
    if (trip === null) {
      throw new TripNotFoundError(tripId);
    }
    if (trip.driverId !== driverId) {
      throw new NotTripDriverError(tripId);
    }
    return trip;
  }

  // Reglas comunes de publicar y modificar: vehículo suyo y activo, plazas
  // dentro de su capacidad y salida en el futuro
  private async assertValidTrip(
    driverId: string,
    trip: Pick<TripInput, 'vehicleId' | 'offeredSeats' | 'departureAt'>,
  ): Promise<void> {
    const vehicle = await this.vehiclesService.getOwn(driverId, trip.vehicleId);
    if (trip.offeredSeats > vehicle.capacity) {
      throw new SeatsExceedCapacityError(trip.offeredSeats, vehicle.capacity);
    }
    if (trip.departureAt.getTime() <= Date.now()) {
      throw new DepartureInThePastError(trip.departureAt);
    }
  }

  // Evento para el Gemelo Digital con el estado completo del viaje
  private async recordEvent(
    manager: EntityManager,
    type: DomainEventType,
    trip: Trip,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: trip.id,
      payload: {
        driverId: trip.driverId,
        vehicleId: trip.vehicleId,
        origin: trip.origin,
        destination: trip.destination,
        departureAt: trip.departureAt.toISOString(),
        offeredSeats: trip.offeredSeats,
        availableSeats: trip.availableSeats,
        maxDetourMin: trip.maxDetourMin,
        status: trip.status,
      },
    });
  }
}
