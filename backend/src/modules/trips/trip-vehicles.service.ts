import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { VehiclesService } from '../users/vehicles.service';
import { Trip } from './entities/trip.entity';
import { SeatsExceedCapacityError } from './errors/seats-exceed-capacity.error';
import { TripNotEditableError } from './errors/trip-not-editable.error';
import { VehicleDeclarationRequiredError } from './errors/vehicle-declaration-required.error';
import { VehicleHasUpcomingTripsError } from './errors/vehicle-has-upcoming-trips.error';
import { TripStatusService } from './trip-status.service';
import { TripsService, TripView } from './trips.service';
import type { TripStatus } from './trip-status';

// Los viajes que aún no han salido y van con un coche concreto: los que se
// quedarían sin poder iniciarse si ese coche se da de baja
const UPCOMING_STATUSES: ReadonlySet<TripStatus> = new Set([
  'published',
  'confirmed',
]);

// Un viaje que ha cambiado de coche: el de antes y el de ahora
export interface TripVehicleChange {
  trip: Trip;
  previousVehicleId: string;
}

export type TripVehicleChangedListener = (
  manager: EntityManager,
  change: TripVehicleChange,
) => Promise<void>;

// Los viajes de un coche y el cambio de coche de varios viajes a la vez (al
// darlo de baja, o por una avería puntual en uno solo). Impide dar de baja un
// coche con viajes programados (VehiclesService.onDeactivationCheck) y avisa
// del cambio a quien se suscriba (requests: a los pasajeros aceptados)
@Injectable()
export class TripVehiclesService implements OnModuleInit {
  private readonly listeners: TripVehicleChangedListener[] = [];

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Trip)
    private readonly tripsRepository: Repository<Trip>,
    private readonly vehiclesService: VehiclesService,
    private readonly tripStatus: TripStatusService,
    private readonly tripsService: TripsService,
  ) {}

  onModuleInit(): void {
    this.vehiclesService.onDeactivationCheck(async (manager, vehicleId) => {
      const count = await manager.countBy(Trip, {
        vehicleId,
        status: In([...UPCOMING_STATUSES]),
      });
      if (count > 0) {
        throw new VehicleHasUpcomingTripsError(vehicleId, count);
      }
    });
  }

  // Patrón observador: quien deba enterarse del cambio, en la misma
  // transacción
  onTripVehicleChanged(listener: TripVehicleChangedListener): void {
    this.listeners.push(listener);
  }

  // Los viajes programados de un coche suyo, del que sale antes al último
  async listUpcoming(driverId: string, vehicleId: string): Promise<TripView[]> {
    await this.vehiclesService.getOwn(driverId, vehicleId);
    const trips = await this.tripsRepository.find({
      select: { id: true },
      where: { driverId, vehicleId, status: In([...UPCOMING_STATUSES]) },
      order: { departureAt: 'ASC', id: 'ASC' },
    });
    return this.tripsService.listDriverViewsByIds(
      driverId,
      trips.map(({ id }) => id),
    );
  }

  // Pasa esos viajes suyos (publicados o confirmados) a otro coche suyo,
  // todos o ninguno. El coche nuevo debe estar activo, con su declaración al
  // día y con sitio para las plazas que ofrece cada viaje. Cada viaje registra
  // trip.updated y avisa a los suscriptores
  async changeVehicle(
    driverId: string,
    change: { tripIds: readonly string[]; vehicleId: string },
  ): Promise<TripView[]> {
    const vehicle = await this.vehiclesService.getOwn(
      driverId,
      change.vehicleId,
    );
    if (!(await this.vehiclesService.isDeclared(driverId, vehicle.id))) {
      throw new VehicleDeclarationRequiredError(vehicle.id);
    }
    // Siempre en el mismo orden (por id), para no bloquearse con otra
    // operación que toque los mismos viajes
    const tripIds = [...new Set(change.tripIds)].sort((a, b) =>
      a.localeCompare(b),
    );
    await this.dataSource.transaction(async (manager) => {
      const trips = await tripIds.reduce<Promise<Trip[]>>(
        (chain, tripId) =>
          chain.then(async (locked) => [
            ...locked,
            await this.tripStatus.lockOwnTrip(manager, driverId, tripId),
          ]),
        Promise.resolve([]),
      );
      for (const trip of trips) {
        assertCanChangeVehicle(trip, vehicle.capacity);
      }
      await trips
        .filter((trip) => trip.vehicleId !== vehicle.id)
        .reduce<Promise<void>>(
          (chain, trip) =>
            chain.then(() => this.moveTrip(manager, trip, vehicle.id)),
          Promise.resolve(),
        );
    });
    return this.tripsService.listDriverViewsByIds(driverId, tripIds);
  }

  private async moveTrip(
    manager: EntityManager,
    trip: Trip,
    vehicleId: string,
  ): Promise<void> {
    const previousVehicleId = trip.vehicleId;
    trip.vehicleId = vehicleId;
    const saved = await this.tripStatus.saveWithEvent(manager, trip);
    await this.listeners.reduce<Promise<void>>(
      (chain, listener) =>
        chain.then(() => listener(manager, { trip: saved, previousVehicleId })),
      Promise.resolve(),
    );
  }
}

// Solo antes de iniciarse (publicado o confirmado, aunque ya sea su hora: si
// no, un viaje que se retrasa impediría dar de baja el coche) y con sitio en
// el coche nuevo para las plazas que ofrece (también las ya ocupadas)
function assertCanChangeVehicle(trip: Trip, capacity: number): void {
  if (!UPCOMING_STATUSES.has(trip.status)) {
    throw new TripNotEditableError(trip.id, trip.status);
  }
  if (trip.offeredSeats > capacity) {
    throw new SeatsExceedCapacityError(trip.offeredSeats, capacity);
  }
}
