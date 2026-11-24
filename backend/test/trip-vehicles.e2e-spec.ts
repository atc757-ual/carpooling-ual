import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

// Los viajes programados de un coche y el cambio de coche de varios viajes, de
// punta a punta: la baja bloqueada, el cambio entero o nada y el aviso a los
// pasajeros aceptados. Los usuarios llevan el prefijo EMAIL_PREFIX; sus
// vehículos, viajes, solicitudes y avisos se borran con ellos
const EMAIL_PREFIX = 'trip-vehicles-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const HOUR_MS = 60 * 60 * 1000;

interface TripBody {
  id: string;
  status: string;
  vehicleId: string;
}

interface ErrorBody {
  code: string;
}

describe('Trip vehicles (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let plateNumber = 7300;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  function api(
    method: 'get' | 'post' | 'put' | 'delete',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function tokenFor(name: string, profiles: string[]): Promise<string> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  async function driver(name: string): Promise<string> {
    const token = await tokenFor(name, ['driver']);
    await api('put', '/users/me/driver-declaration', token).expect(200);
    return token;
  }

  async function vehicle(token: string, capacity = 4): Promise<string> {
    plateNumber += 1;
    const created = await api('post', '/vehicles', token)
      .send({
        plate: `${plateNumber}KTV`,
        capacity,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  // Con hoursLater, unas horas después de la primera salida posible (dos
  // viajes del mismo conductor no pueden solaparse)
  async function trip(
    token: string,
    vehicleId: string,
    options: { offeredSeats?: number; hoursLater?: number } = {},
  ): Promise<string> {
    const departureAt = new Date(
      publishableDeparture().getTime() + (options.hoursLater ?? 0) * HOUR_MS,
    );
    const created = await api('post', '/trips', token)
      .send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        originName: 'Almería',
        destinationName: 'Campus UAL',
        departureAt: departureAt.toISOString(),
        offeredSeats: options.offeredSeats ?? 2,
      })
      .expect(201);
    return (created.body as { id: string }).id;
  }

  async function accept(
    driverToken: string,
    passenger: string,
    tripId: string,
  ): Promise<void> {
    const created = await api('post', `/trips/${tripId}/requests`, passenger)
      .send({ seats: 1 })
      .expect(201);
    const requestId = (created.body as { id: string }).id;
    await api('post', `/requests/${requestId}/accept`, driverToken).expect(200);
  }

  function changeVehicle(
    token: string,
    tripIds: string[],
    vehicleId: string,
  ): request.Test {
    return api('post', '/trips/vehicle-changes', token).send({
      tripIds,
      vehicleId,
    });
  }

  async function notificationTypes(token: string): Promise<string[]> {
    const response = await api('get', '/users/me/notifications', token).expect(
      200,
    );
    return (response.body as { type: string }[]).map(({ type }) => type);
  }

  it('blocks giving up a vehicle with upcoming trips until they move to another one', async () => {
    const dan = await driver('dan');
    const seat = await vehicle(dan);
    const other = await vehicle(dan);
    const tripId = await trip(dan, seat);

    const listed = await api(
      'get',
      `/vehicles/${seat}/upcoming-trips`,
      dan,
    ).expect(200);
    expect(listed.headers['x-total-count']).toBe('1');
    expect((listed.body as TripBody[]).map(({ id }) => id)).toEqual([tripId]);

    const blocked = await api('delete', `/vehicles/${seat}`, dan).expect(409);
    expect((blocked.body as ErrorBody).code).toBe('VEHICLE_HAS_UPCOMING_TRIPS');

    const moved = await changeVehicle(dan, [tripId], other).expect(200);
    expect((moved.body as TripBody[])[0].vehicleId).toBe(other);
    const empty = await api(
      'get',
      `/vehicles/${seat}/upcoming-trips`,
      dan,
    ).expect(200);
    expect(empty.body).toEqual([]);
    await api('delete', `/vehicles/${seat}`, dan).expect(204);
  });

  it('notifies only the accepted passengers of the new vehicle', async () => {
    const dan = await driver('dan');
    const seat = await vehicle(dan);
    const other = await vehicle(dan);
    const tripId = await trip(dan, seat, { offeredSeats: 3 });
    const pia = await tokenFor('pia', ['passenger']);
    const leo = await tokenFor('leo', ['passenger']);
    await accept(dan, pia, tripId);
    await api('post', `/trips/${tripId}/requests`, leo)
      .send({ seats: 1 })
      .expect(201);

    await changeVehicle(dan, [tripId], other).expect(200);

    expect(await notificationTypes(pia)).toContain('trip_vehicle_changed');
    expect(await notificationTypes(leo)).not.toContain('trip_vehicle_changed');
  });

  it('moves all the trips or none', async () => {
    const dan = await driver('dan');
    const seat = await vehicle(dan);
    const small = await vehicle(dan, 2);
    const fits = await trip(dan, seat, { offeredSeats: 1 });
    const tooBig = await trip(dan, seat, { offeredSeats: 3, hoursLater: 3 });

    const refused = await changeVehicle(dan, [fits, tooBig], small).expect(400);
    expect((refused.body as ErrorBody).code).toBe('SEATS_EXCEED_CAPACITY');
    const still = await api(
      'get',
      `/vehicles/${seat}/upcoming-trips`,
      dan,
    ).expect(200);
    expect(still.headers['x-total-count']).toBe('2');
  });

  it('refuses a trip that has already started or been cancelled', async () => {
    const dan = await driver('dan');
    const seat = await vehicle(dan);
    const other = await vehicle(dan);
    const started = await trip(dan, seat);
    const pia = await tokenFor('pia', ['passenger']);
    await accept(dan, pia, started);
    await setDepartureIn(dataSource, started, 5);
    await api('post', `/trips/${started}/start`, dan).expect(200);
    const cancelled = await trip(dan, other, { hoursLater: 3 });
    await api('post', `/trips/${cancelled}/cancel`, dan).expect(200);

    const inProgress = await changeVehicle(dan, [started], other).expect(409);
    expect((inProgress.body as ErrorBody).code).toBe('TRIP_NOT_EDITABLE');
    const gone = await changeVehicle(dan, [cancelled], seat).expect(409);
    expect((gone.body as ErrorBody).code).toBe('TRIP_NOT_EDITABLE');
  });

  it('only works with the trips and vehicles of the driver', async () => {
    const dan = await driver('dan');
    const eva = await driver('eva');
    const dansCar = await vehicle(dan);
    const evasCar = await vehicle(eva);
    const dansTrip = await trip(dan, dansCar);

    const notMine = await changeVehicle(eva, [dansTrip], evasCar).expect(403);
    expect((notMine.body as ErrorBody).code).toBe('NOT_TRIP_DRIVER');
    const otherCar = await changeVehicle(dan, [dansTrip], evasCar).expect(404);
    expect((otherCar.body as ErrorBody).code).toBe('VEHICLE_NOT_FOUND');
    await api('get', `/vehicles/${dansCar}/upcoming-trips`, eva).expect(404);
  });
});
