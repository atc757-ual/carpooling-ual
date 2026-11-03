import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleAlreadyRegisteredError } from './errors/vehicle-already-registered.error';
import { VehicleInUseError } from './errors/vehicle-in-use.error';
import { VehicleNotFoundError } from './errors/vehicle-not-found.error';
import { VehicleColorsService } from '../catalogs/vehicle-colors.service';
import { VehiclesService } from './vehicles.service';

// Tests unitarios de lo que no se puede provocar fácilmente contra la base de
// datos real (dos registros simultáneos). El resto, en
// test/vehicles-service.e2e-spec.ts
describe('VehiclesService', () => {
  let vehiclesService: VehiclesService;
  const vehiclesRepository = {
    findOneBy: jest.fn(),
    findBy: jest.fn(),
    countBy: jest.fn(),
    create: jest.fn((values: Partial<Vehicle>) => values),
    save: jest.fn(),
  };
  const isOffered = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    vehiclesRepository.findOneBy.mockResolvedValue(null);
    vehiclesRepository.findBy.mockResolvedValue([]);
    vehiclesRepository.countBy.mockResolvedValue(0);
    isOffered.mockResolvedValue(true);
    const moduleRef = await Test.createTestingModule({
      providers: [
        VehiclesService,
        { provide: getRepositoryToken(Vehicle), useValue: vehiclesRepository },
        { provide: VehicleColorsService, useValue: { isOffered } },
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
        constraint: 'vehicles_plate_country_plate_key',
      }),
    );

    await expect(
      vehiclesService.register('driver-1', {
        plate: '9001BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
      }),
    ).rejects.toBeInstanceOf(VehicleAlreadyRegisteredError);
  });

  it('lets any other database error through', async () => {
    const connectionLost = new Error('Connection terminated');
    vehiclesRepository.save.mockRejectedValue(connectionLost);

    await expect(
      vehiclesService.register('driver-1', {
        plate: '9001BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
      }),
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
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
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

    it('still changes color and engine, or the same seats', async () => {
      vehiclesRepository.findOneBy.mockResolvedValue(onTrip());
      vehiclesRepository.save.mockImplementation((vehicle: Vehicle) =>
        Promise.resolve(vehicle),
      );

      const updated = await vehiclesService.update('d1', 'v1', {
        color: 'red',
        engine: 'electric',
        capacity: 4,
      });

      expect(updated).toMatchObject({
        color: 'red',
        engine: 'electric',
        capacity: 4,
      });
    });
  });

  it('registers the make, model, color and engine separately', async () => {
    vehiclesRepository.save.mockImplementation((vehicle: Vehicle) =>
      Promise.resolve(vehicle),
    );

    const created = await vehiclesService.register('driver-1', {
      plate: '9001BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });

    expect(created).toMatchObject({
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
  });

  it('returns recognition details for a list of vehicle ids', async () => {
    vehiclesRepository.findBy.mockResolvedValue([
      {
        id: 'v1',
        plate: '1234BCD',
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
      },
    ]);

    await expect(
      vehiclesService.getRecognitionDetails(['v1']),
    ).resolves.toEqual(
      new Map([['v1', { brand: 'Seat', model: 'Ibiza', color: 'blue' }]]),
    );
  });

  it('rejects a color that is not offered and keeps an old one on edit', async () => {
    isOffered.mockResolvedValue(false);
    await expect(
      vehiclesService.register('d1', {
        plate: '1234BCD',
        capacity: 3,
        brand: 'SEAT',
        model: 'Ibiza',
        color: 'gold',
        engine: 'hybrid',
      }),
    ).rejects.toMatchObject({ code: 'VEHICLE_COLOR_NOT_OFFERED' });

    const vehicle = {
      id: 'v1',
      driverId: 'd1',
      color: 'gold',
      status: 'available',
      capacity: 3,
    };
    vehiclesRepository.findOneBy.mockResolvedValue(vehicle);
    vehiclesRepository.save.mockImplementation((saved: unknown) =>
      Promise.resolve(saved),
    );
    await expect(
      vehiclesService.update('d1', 'v1', { color: 'gold', capacity: 4 }),
    ).resolves.toMatchObject({ color: 'gold', capacity: 4 });
    await expect(
      vehiclesService.update('d1', 'v1', { color: 'pink' }),
    ).rejects.toMatchObject({ code: 'VEHICLE_COLOR_NOT_OFFERED' });
  });
});
