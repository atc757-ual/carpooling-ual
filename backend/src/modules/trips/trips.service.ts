import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import type { Point } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';
import { TripRoute } from './entities/trip-route.entity';
import { Trip } from './entities/trip.entity';
import { DepartureInThePastError } from './errors/departure-in-the-past.error';
import { DepartureTooSoonError } from './errors/departure-too-soon.error';
import { DriverNotReadyError } from './errors/driver-not-ready.error';
import { SeatsExceedCapacityError } from './errors/seats-exceed-capacity.error';
import { TripAlreadyStartedError } from './errors/trip-already-started.error';
import { TripNotEditableError } from './errors/trip-not-editable.error';
import { TripNotFoundError } from './errors/trip-not-found.error';
import { TripNotInProgressError } from './errors/trip-not-in-progress.error';
import { TripNotStartableYetError } from './errors/trip-not-startable-yet.error';
import {
  isLateDriverCancellation,
  LateCancellationsService,
} from './late-cancellations.service';
import type { RoutePlan } from './route-plan';
import { TripRoutesService } from './trip-routes.service';
import { TripStatusService } from './trip-status.service';
import {
  MIN_DEPARTURE_LEAD_MIN,
  MINUTE_MS,
  START_WINDOW_MIN,
} from './trip-timing';

// La salida, con al menos una hora de antelación (si ya pasó, manda
// DEPARTURE_IN_THE_PAST, que se comprueba antes)
function assertDepartureLead(departureAt: Date): void {
  if (departureAt.getTime() - Date.now() < MIN_DEPARTURE_LEAD_MIN * MINUTE_MS) {
    throw new DepartureTooSoonError(departureAt, MIN_DEPARTURE_LEAD_MIN);
  }
}

export interface TripInput {
  vehicleId: string;
  origin: Point;
  destination: Point;
  departureAt: Date;
  offeredSeats: number;
  maxDetourMin?: number;
  originName?: string;
  destinationName?: string;
}

// Modificación parcial: solo los campos que cambian
export type TripChanges = Partial<TripInput>;

// Un viaje con el nombre de su conductor (lo que ve un pasajero)
export interface TripView {
  trip: Trip;
  driverName: string;
}

// Un viaje con su ruta (RF-12)
export interface TripRouteView {
  trip: Trip;
  route: TripRoute;
}

const DEFAULT_MAX_DETOUR_MIN = 10;

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
    private readonly tripRoutes: TripRoutesService,
    private readonly lateCancellations: LateCancellationsService,
  ) {}

  // RF-04: publicar un viaje. Antes, RF-21: el conductor debe estar listo y
  // no tener la publicación suspendida por cancelaciones tardías; la salida,
  // con al menos una hora de antelación
  async publish(driverId: string, input: TripInput): Promise<TripView> {
    const readiness = await this.usersService.getDriverReadiness(driverId);
    if (!readiness.isReady) {
      throw new DriverNotReadyError(readiness);
    }
    await this.lateCancellations.assertCanPublish(driverId);
    await this.assertValidTrip(driverId, input);
    assertDepartureLead(input.departureAt);
    // RF-12: la ruta se calcula antes de la transacción (sin bloquear filas
    // mientras se espera a OSRM) y se guarda con el viaje
    const route = await this.tripRoutes.plan(input.origin, input.destination);

    const trip = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        manager.create(Trip, {
          ...input,
          driverId,
          maxDetourMin: input.maxDetourMin ?? DEFAULT_MAX_DETOUR_MIN,
          availableSeats: input.offeredSeats,
        }),
      );
      await this.tripRoutes.save(manager, saved.id, route);
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

  // RF-12: la ruta de un viaje, con el viaje (para el estado y la llegada
  // estimada). La ve quien puede ver el viaje
  async getRoute(tripId: string): Promise<TripRouteView> {
    const { trip } = await this.getById(tripId);
    const route = await this.tripRoutes.getForTrip(tripId);
    return { trip, route };
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
    const route = await this.planChangedRoute(tripId, changes);
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
      // La antelación solo cuenta si se mueve la salida: cambiar las plazas de
      // un viaje que sale pronto sigue permitido
      if (changes.departureAt !== undefined) {
        assertDepartureLead(changes.departureAt);
      }

      Object.assign(current, changes);
      current.availableSeats = current.offeredSeats;
      if (route !== null) {
        await this.tripRoutes.save(manager, current.id, route);
      }
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
      // Con pasajeros y a menos de 30 minutos, se registra como tardía (cuenta
      // para suspender la publicación)
      const isLate = isLateDriverCancellation(current, new Date());
      // Avisa a los suscriptores: las solicitudes se cancelan con el viaje
      const cancelled = await this.tripStatus.changeStatus(
        manager,
        current,
        'cancelled',
      );
      if (isLate) {
        await this.lateCancellations.recordDriverCancellation(
          manager,
          cancelled,
        );
      }
      return cancelled;
    });
    return this.toView(trip);
  }

  // RF-11: iniciar. Solo un viaje confirmado (con pasajeros), desde 10 minutos
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

  // RF-23: el último pasajero se ha bajado de un viaje EN CURSO (con su
  // incidencia, en la misma transacción): el viaje termina y el conductor
  // queda libre, como al finalizarlo. Quien llama ya tiene el viaje bloqueado
  async finishWithoutPassengers(
    manager: EntityManager,
    trip: Trip,
  ): Promise<Trip> {
    const finished = await this.tripStatus.changeStatus(
      manager,
      trip,
      'finished',
    );
    await this.vehiclesService.markAvailable(manager, trip.vehicleId);
    return finished;
  }

  // RF-23: el conductor cancela DURANTE el viaje (con una incidencia, que
  // registra el módulo incidents en la misma transacción: por eso recibe el
  // manager). El vehículo vuelve a estar disponible, para que pueda publicar
  // otros viajes; las solicitudes reaccionan al aviso de cambio de estado
  async cancelInProgress(
    manager: EntityManager,
    driverId: string,
    tripId: string,
  ): Promise<Trip> {
    const trip = await this.tripStatus.lockOwnTrip(manager, driverId, tripId);
    if (trip.status !== 'in_progress') {
      throw new TripNotInProgressError(trip.id, trip.status);
    }
    const cancelled = await this.tripStatus.changeStatus(
      manager,
      trip,
      'cancelled',
    );
    await this.vehiclesService.markAvailable(manager, trip.vehicleId);
    return cancelled;
  }

  // RF-12: si cambia el origen o el destino, la nueva ruta (antes de la
  // transacción, como al publicar); si no, null y se conserva la que tenía
  private async planChangedRoute(
    tripId: string,
    changes: TripChanges,
  ): Promise<RoutePlan | null> {
    if (changes.origin === undefined && changes.destination === undefined) {
      return null;
    }
    const { trip } = await this.getById(tripId);
    return this.tripRoutes.plan(
      changes.origin ?? trip.origin,
      changes.destination ?? trip.destination,
    );
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
