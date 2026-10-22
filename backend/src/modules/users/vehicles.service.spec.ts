import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { QueryFailedError } from 'typeorm';
import { Vehicle } from './entities/vehicle.entity';
import { VehicleAlreadyRegisteredError } from './errors/vehicle-already-registered.error';
import { VehiclesService } from './vehicles.service';

// Tests unitarios de lo que no se puede provocar fácilmente contra la base de
// datos real (dos registros simultáneos). El resto, en
// test/vehicles-service.e2e-spec.ts
describe('VehiclesService', () => {
  let vehiclesService: VehiclesService;
  const vehiclesRepository = {
    findOneBy: jest.fn(),
    create: jest.fn((values: Partial<Vehicle>) => values),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    vehiclesRepository.findOneBy.mockResolvedValue(null);
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
});
