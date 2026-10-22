import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
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
}

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
      existing.status = 'available';
      return this.vehiclesRepository.save(existing);
    }

    try {
      return await this.vehiclesRepository.save(
        this.vehiclesRepository.create({
          driverId,
          plate,
          capacity: input.capacity,
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
