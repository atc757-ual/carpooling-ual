import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Not, Repository } from 'typeorm';
import { isUniqueViolation } from '../../shared/database/postgres-errors';
import { Page, PageRequest } from '../../shared/pagination/page';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleAlreadyRegisteredError } from './errors/vehicle-already-registered.error';
import { VehicleInUseError } from './errors/vehicle-in-use.error';
import { VehicleNotFoundError } from './errors/vehicle-not-found.error';
import { normalizePlate } from './vehicle-plate';

export interface RegisterVehicleInput {
  plate: string;
  capacity: number;
  model?: string;
}

export type UpdateVehicleInput = Partial<Omit<RegisterVehicleInput, 'plate'>>;

// Restricción UNIQUE de la matrícula (migración InitialSchema)
const PLATE_UNIQUE_CONSTRAINT = 'vehicles_plate_key';

// Vehículos de los conductores (RF-21). Siempre trabaja con los vehículos de UN
// conductor: nunca devuelve ni modifica los de otro
@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
  ) {}

  // Registra un vehículo. Si el mismo conductor lo había dado de baja, se
  // reactiva con la nueva capacidad (la matrícula es única en toda la tabla)
  async register(
    driverId: string,
    input: RegisterVehicleInput,
  ): Promise<Vehicle> {
    const plate = normalizePlate(input.plate);
    const existing = await this.vehiclesRepository.findOneBy({ plate });

    if (existing !== null) {
      const isOwnInactive =
        existing.driverId === driverId && existing.status === 'inactive';
      if (!isOwnInactive) {
        throw new VehicleAlreadyRegisteredError(plate);
      }
      existing.capacity = input.capacity;
      existing.model = input.model ?? existing.model;
      existing.status = 'available';
      return this.vehiclesRepository.save(existing);
    }

    try {
      return await this.vehiclesRepository.save(
        this.vehiclesRepository.create({
          driverId,
          plate,
          capacity: input.capacity,
          model: input.model ?? null,
        }),
      );
    } catch (error) {
      // Dos registros simultáneos de la misma matrícula: lo detecta el UNIQUE
      if (isUniqueViolation(error, PLATE_UNIQUE_CONSTRAINT)) {
        throw new VehicleAlreadyRegisteredError(plate);
      }
      throw error;
    }
  }

  // Vehículos activos (no dados de baja) del conductor, del más antiguo al
  // más reciente, con el total para la paginación
  async listByDriver(
    driverId: string,
    page: PageRequest,
  ): Promise<Page<Vehicle>> {
    const [items, total] = await this.vehiclesRepository.findAndCount({
      where: { driverId, status: Not('inactive') },
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  // Un vehículo activo del conductor. De otro conductor, o dado de baja, es
  // como si no existiera (no se revela qué ids existen)
  async getOwn(driverId: string, vehicleId: string): Promise<Vehicle> {
    const vehicle = await this.vehiclesRepository.findOneBy({
      id: vehicleId,
      driverId,
      status: Not('inactive'),
    });
    if (vehicle === null) {
      throw new VehicleNotFoundError(vehicleId);
    }
    return vehicle;
  }

  // Cambia el modelo o las plazas de un vehículo del conductor. Las plazas no
  // se cambian mientras está en un viaje en curso; los viajes ya publicados
  // conservan las plazas que ofrecían (el cambio vale para los siguientes)
  async update(
    driverId: string,
    vehicleId: string,
    input: UpdateVehicleInput,
  ): Promise<Vehicle> {
    const vehicle = await this.getOwn(driverId, vehicleId);
    const changesCapacity =
      input.capacity !== undefined && input.capacity !== vehicle.capacity;
    if (changesCapacity && vehicle.status === 'on_trip') {
      throw new VehicleInUseError(vehicleId);
    }
    vehicle.capacity = input.capacity ?? vehicle.capacity;
    vehicle.model = input.model ?? vehicle.model;
    return this.vehiclesRepository.save(vehicle);
  }

  // RF-11: al iniciar un viaje, el vehículo pasa a "en viaje". Recibe el
  // manager de la transacción del viaje y bloquea la fila del vehículo, así
  // un mismo coche no puede estar en dos viajes en curso a la vez
  async markOnTrip(manager: EntityManager, vehicleId: string): Promise<void> {
    const vehicle = await manager.findOne(Vehicle, {
      where: { id: vehicleId },
      lock: { mode: 'pessimistic_write' },
    });
    if (vehicle === null || vehicle.status === 'inactive') {
      throw new VehicleNotFoundError(vehicleId);
    }
    if (vehicle.status === 'on_trip') {
      throw new VehicleInUseError(vehicleId);
    }
    await manager.update(Vehicle, vehicleId, { status: 'on_trip' });
  }

  // RF-11: al finalizar el viaje, el vehículo vuelve a estar disponible
  async markAvailable(
    manager: EntityManager,
    vehicleId: string,
  ): Promise<void> {
    await manager.update(
      Vehicle,
      { id: vehicleId, status: 'on_trip' },
      { status: 'available' },
    );
  }

  // Matrícula de un vehículo, aunque esté dado de baja (los viajes pasados lo
  // siguen referenciando). La ven los pasajeros con la solicitud aceptada
  async getPlate(vehicleId: string): Promise<string> {
    const vehicle = await this.vehiclesRepository.findOneBy({ id: vehicleId });
    if (vehicle === null) {
      throw new VehicleNotFoundError(vehicleId);
    }
    return vehicle.plate;
  }

  // Número de vehículos activos del conductor (RF-21)
  countActive(driverId: string): Promise<number> {
    return this.vehiclesRepository.countBy({
      driverId,
      status: Not('inactive'),
    });
  }

  // Da de baja un vehículo del conductor: pasa a inactive y deja de poder
  // usarse en viajes nuevos, pero los viajes pasados lo siguen referenciando
  async deactivate(driverId: string, vehicleId: string): Promise<void> {
    const vehicle = await this.getOwn(driverId, vehicleId);
    if (vehicle.status === 'on_trip') {
      throw new VehicleInUseError(vehicleId);
    }
    await this.vehiclesRepository.update(vehicle.id, { status: 'inactive' });
  }
}
