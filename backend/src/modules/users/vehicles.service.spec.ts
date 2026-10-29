import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleAlreadyRegisteredError } from './errors/vehicle-already-registered.error';
import { VehicleInUseError } from './errors/vehicle-in-use.error';
import { VehicleNotFoundError } from './errors/vehicle-not-found.error';
import { VehiclesService } from './vehicles.service';

// Tests unitarios de lo que no se puede provocar fácilmente contra la base de
// datos real (dos registros simultáneos). El resto, en
// test/vehicles-service.e2e-spec.ts
describe('VehiclesService', () => {
  let vehiclesService: VehiclesService;
  const vehiclesRepository = {
    findOneBy: jest.fn(),
    countBy: jest.fn(),
    create: jest.fn((values: Partial<Vehicle>) => values),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vehiclesRepository.findOneBy.mockResolvedValue(null);
    vehiclesRepository.countBy.mockResolvedValue(0);
    const moduleRef = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: getRepositoryToken(Vehicle), useValue: vehiclesRepository },
      ],
    }).compile();
    vehiclesService = moduleRef.get(VehiclesService);
  });

  it('turns a simultaneous registration of the same plate into VEHICLE_ALREADY_REGISTERED', async () => {
    // La matrícula estaba libre al comprobarla, pero otra petición la ha
    // guardado justo antes: lo detecta la restricción UNIQUE
    vehiclesRepository.save.mockRejectedValue(
      new QueryFailedError('INSERT ...', [], {
        code: '23505',
        constraint: 'vehicles_plate_key',
      }),
    );

    await expect(
      vehiclesService.register('driver-1', { plate: '9001BCD', capacity: 4 }),
    ).rejects.toBeInstanceOf(VehicleAlreadyRegisteredError);
  });

  it('lets any other database error through', async () => {
    const connectionLost = new Error('Connection terminated');
    vehiclesRepository.save.mockRejectedValue(connectionLost);

    await expect(
      vehiclesService.register('driver-1', { plate: '9001BCD', capacity: 4 }),
    ).rejects.toBe(connectionLost);
  });

  it('answers VEHICLE_NOT_FOUND for the plate of an unknown vehicle', async () => {
    await expect(vehiclesService.getPlate('unknown')).rejects.toBeInstanceOf(
      VehicleNotFoundError,
    );
  });

  describe('update', () => {
    const onTrip = (): Vehicle =>
      ({
        id: 'v1',
        driverId: 'd1',
        plate: '1234BCD',
        model: 'Seat Ibiza',
        capacity: 4,
        status: 'on_trip',
      }) as Vehicle;

    it('does not change the seats of a vehicle on a trip', async () => {
      vehiclesRepository.findOneBy.mockResolvedValue(onTrip());

      await expect(
        vehiclesService.update('d1', 'v1', { capacity: 3 }),
      ).rejects.toBeInstanceOf(VehicleInUseError);
      expect(vehiclesRepository.save).not.toHaveBeenCalled();
    });

    it('still changes its model, or the same seats', async () => {
      vehiclesRepository.findOneBy.mockResolvedValue(onTrip());
      vehiclesRepository.save.mockImplementation((vehicle: Vehicle) =>
        Promise.resolve(vehicle),
      );

      const updated = await vehiclesService.update('d1', 'v1', {
        model: 'Seat León',
        capacity: 4,
      });

      expect(updated).toMatchObject({ model: 'Seat León', capacity: 4 });
    });
  });
});
