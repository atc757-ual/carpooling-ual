import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { VehicleAlreadyRegisteredError } from '../src/modules/users/errors/vehicle-already-registered.error';
import { VehicleInUseError } from '../src/modules/users/errors/vehicle-in-use.error';
import { VehicleLimitReachedError } from '../src/modules/users/errors/vehicle-limit-reached.error';
import { VehicleNotFoundError } from '../src/modules/users/errors/vehicle-not-found.error';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { deleteTestUsers } from './support/cleanup';

// VehiclesService contra la base de datos real (requiere npm run migrate). Los
// conductores llevan el prefijo EMAIL_PREFIX; al borrarlos en afterEach, sus
// perfiles y vehículos se borran en cascada
const EMAIL_PREFIX = 'vehicles-test-';
const ALL = { offset: 0, limit: 100 };

describe('VehiclesService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let vehiclesService: VehiclesService;
  let usersService: UsersService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    vehiclesService = app.get(VehiclesService);
    usersService = app.get(UsersService);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createDriver(name: string): Promise<string> {
    const user = await usersService.createWithProfiles({
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles: ['driver'],
    });
    return user.id;
  }

  it('registers a vehicle with the plate normalized', async () => {
    const ana = await createDriver('ana');

    const vehicle = await vehiclesService.register(ana, {
      plate: '9001 bcd',
      capacity: 4,
    });

    expect(vehicle).toMatchObject({
      driverId: ana,
      plate: '9001BCD',
      capacity: 4,
      status: 'available',
    });
  });

  it('rejects a plate already registered by another driver', async () => {
    const ana = await createDriver('ana');
    const bob = await createDriver('bob');
    await vehiclesService.register(ana, { plate: '9002BCD', capacity: 4 });

    await expect(
      vehiclesService.register(bob, { plate: '9002-bcd', capacity: 3 }),
    ).rejects.toBeInstanceOf(VehicleAlreadyRegisteredError);
  });

  it('rejects registering again an active vehicle of the same driver', async () => {
    const ana = await createDriver('ana');
    await vehiclesService.register(ana, { plate: '9003BCD', capacity: 4 });

    await expect(
      vehiclesService.register(ana, { plate: '9003BCD', capacity: 4 }),
    ).rejects.toBeInstanceOf(VehicleAlreadyRegisteredError);
  });

  it('reactivates a vehicle the same driver had deactivated', async () => {
    const ana = await createDriver('ana');
    const first = await vehiclesService.register(ana, {
      plate: '9004BCD',
      capacity: 4,
    });
    await vehiclesService.deactivate(ana, first.id);

    const again = await vehiclesService.register(ana, {
      plate: '9004BCD',
      capacity: 5,
    });

    expect(again).toMatchObject({
      id: first.id,
      capacity: 5,
      status: 'available',
    });
  });

  it('allows at most 3 active vehicles; a deactivated one frees its place', async () => {
    const ana = await createDriver('ana');
    const first = await vehiclesService.register(ana, {
      plate: '9041BCD',
      capacity: 4,
    });
    await vehiclesService.register(ana, { plate: '9042BCD', capacity: 4 });
    await vehiclesService.register(ana, { plate: '9043BCD', capacity: 4 });

    await expect(
      vehiclesService.register(ana, { plate: '9044BCD', capacity: 4 }),
    ).rejects.toBeInstanceOf(VehicleLimitReachedError);

    await vehiclesService.deactivate(ana, first.id);
    await expect(
      vehiclesService.register(ana, { plate: '9044BCD', capacity: 4 }),
    ).resolves.toMatchObject({ plate: '9044BCD' });
  });

  it('lists only the active vehicles of the driver, with the total', async () => {
    const ana = await createDriver('ana');
    const bob = await createDriver('bob');
    const car = await vehiclesService.register(ana, {
      plate: '9005BCD',
      capacity: 4,
    });
    await vehiclesService.register(ana, { plate: '9006BCD', capacity: 2 });
    await vehiclesService.register(ana, { plate: '9007BCD', capacity: 3 });
    await vehiclesService.register(bob, { plate: '9008BCD', capacity: 4 });
    await vehiclesService.deactivate(ana, car.id);

    const page = await vehiclesService.listByDriver(ana, {
      offset: 1,
      limit: 1,
    });

    expect(page.total).toBe(2);
    expect(page.items.map(({ plate }) => plate)).toEqual(['9007BCD']);
  });

  it('deactivates a vehicle: it disappears from the list but still exists', async () => {
    const ana = await createDriver('ana');
    const car = await vehiclesService.register(ana, {
      plate: '9009BCD',
      capacity: 4,
    });

    await vehiclesService.deactivate(ana, car.id);

    await expect(vehiclesService.listByDriver(ana, ALL)).resolves.toEqual({
      items: [],
      total: 0,
    });
    const [row] = await dataSource.query<{ status: string }[]>(
      'SELECT status FROM vehicles WHERE id = $1',
      [car.id],
    );
    expect(row.status).toBe('inactive');
  });

  it("answers VEHICLE_NOT_FOUND for another driver's vehicle", async () => {
    const ana = await createDriver('ana');
    const bob = await createDriver('bob');
    const car = await vehiclesService.register(ana, {
      plate: '9010BCD',
      capacity: 4,
    });

    await expect(
      vehiclesService.deactivate(bob, car.id),
    ).rejects.toBeInstanceOf(VehicleNotFoundError);
  });

  it('answers VEHICLE_NOT_FOUND when deactivating twice', async () => {
    const ana = await createDriver('ana');
    const car = await vehiclesService.register(ana, {
      plate: '9011BCD',
      capacity: 4,
    });
    await vehiclesService.deactivate(ana, car.id);

    await expect(
      vehiclesService.deactivate(ana, car.id),
    ).rejects.toBeInstanceOf(VehicleNotFoundError);
  });

  it('does not deactivate a vehicle that is on a trip', async () => {
    const ana = await createDriver('ana');
    const car = await vehiclesService.register(ana, {
      plate: '9012BCD',
      capacity: 4,
    });
    await dataSource.query(
      "UPDATE vehicles SET status = 'on_trip' WHERE id = $1",
      [car.id],
    );

    await expect(
      vehiclesService.deactivate(ana, car.id),
    ).rejects.toBeInstanceOf(VehicleInUseError);
  });
});
