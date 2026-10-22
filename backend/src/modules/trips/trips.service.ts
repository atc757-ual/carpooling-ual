import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import { Trip } from './entities/trip.entity';
import { DepartureInThePastError } from './errors/departure-in-the-past.error';
import { DriverNotReadyError } from './errors/driver-not-ready.error';
import { SeatsExceedCapacityError } from './errors/seats-exceed-capacity.error';
import { TripAlreadyStartedError } from './errors/trip-already-started.error';
import { TripNotEditableError } from './errors/trip-not-editable.error';
import { TripNotFoundError } from './errors/trip-not-found.error';
import { TripNotStartableYetError } from './errors/trip-not-startable-yet.error';
import { TripStatusService } from './trip-status.service';

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

// RF-11: un viaje se puede iniciar desde estos minutos antes de su salida (el
// conductor suele recoger a los pasajeros un poco antes), sin límite después
const START_WINDOW_MIN = 30;
const MINUTE_MS = 60 * 1000;

// Viajes (RF-04, RF-05, RF-11): las operaciones del usuario. Los cambios de
// estado, los eventos (outbox, RNF-08) y las plazas los hace TripStatusService
@Injectable()
export class TripsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    private readonly usersService: UsersService,
    private readonly vehiclesService: VehiclesService,
    private readonly tripStatus: TripStatusService,
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
      await this.tripStatus.recordEvent(manager, 'trip.published', saved);
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
      const current = await this.tripStatus.lockOwnTrip(
        manager,
        driverId,
        tripId,
      );
      if (current.status !== 'published') {
        throw new TripNotEditableError(current.id, current.status);
      }
      await this.assertValidTrip(driverId, { ...current, ...changes });

      Object.assign(current, changes);
      current.availableSeats = current.offeredSeats;
      return this.tripStatus.saveWithEvent(manager, current);
    });
    return this.toView(trip);
  }

  // RF-05: cancelar antes del inicio. Durante el viaje exige una incidencia
  // (RF-23), que llegará con su propio flujo
  async cancel(driverId: string, tripId: string): Promise<TripView> {
    const trip = await this.dataSource.transaction(async (manager) => {
      const current = await this.tripStatus.lockOwnTrip(
        manager,
        driverId,
        tripId,
      );
      if (current.status === 'in_progress') {
        throw new TripAlreadyStartedError(current.id);
      }
      // Avisa a los suscriptores: las solicitudes se cancelan con el viaje
      return this.tripStatus.changeStatus(manager, current, 'cancelled');
    });
    return this.toView(trip);
  }

  // RF-11: iniciar. Solo un viaje confirmado (con pasajeros), desde 30 minutos
  // antes de su salida. El vehículo pasa a "en viaje" y las solicitudes
  // pendientes se rechazan (las rechaza su módulo al recibir el aviso)
  async start(driverId: string, tripId: string): Promise<TripView> {
    const trip = await this.dataSource.transaction(async (manager) => {
      const current = await this.tripStatus.lockOwnTrip(
        manager,
        driverId,
        tripId,
      );
      const minutesToDeparture =
        (current.departureAt.getTime() - Date.now()) / MINUTE_MS;
      if (minutesToDeparture > START_WINDOW_MIN) {
        throw new TripNotStartableYetError(
          current.id,
          current.departureAt,
          START_WINDOW_MIN,
        );
      }
      await this.vehiclesService.markOnTrip(manager, current.vehicleId);
      return this.tripStatus.changeStatus(manager, current, 'in_progress');
    });
    return this.toView(trip);
  }

  // RF-11: finalizar un viaje en curso. El vehículo vuelve a estar disponible;
  // las solicitudes aceptadas terminan con el viaje sin cambiar de estado
  async finish(driverId: string, tripId: string): Promise<TripView> {
    const trip = await this.dataSource.transaction(async (manager) => {
      const current = await this.tripStatus.lockOwnTrip(
        manager,
        driverId,
        tripId,
      );
      const finished = await this.tripStatus.changeStatus(
        manager,
        current,
        'finished',
      );
      await this.vehiclesService.markAvailable(manager, current.vehicleId);
      return finished;
    });
    return this.toView(trip);
  }

  // El viaje con el nombre de su conductor
  private async toView(trip: Trip): Promise<TripView> {
    const { name } = await this.usersService.getSummary(trip.driverId);
    return { trip, driverName: name };
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
}
