import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Presupuesto total de desvío (reunión con el director del 12/11/2026): al
// aceptar, la ruta pasa por todas las recogidas, cada parada suma 2 min y el
// total cabe en el desvío máximo del viaje. Las cifras valen igual con OSRM
// (en local) que con la ruta estimada (en el CI, sin OSRM)
const EMAIL_PREFIX = 'pickup-budget-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
// Cerca de la salida y cerca del campus, en el camino
const NEAR_START = { type: 'Point', coordinates: [-2.455, 36.837] };
const NEAR_CAMPUS = { type: 'Point', coordinates: [-2.42, 36.832] };

interface RequestBody {
  id: string;
  pickupAt: string;
}

describe('Detour budget of a trip (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

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
    method: 'get' | 'post' | 'put',
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

  async function driverWithTrip(
    maxDetourMin: number,
  ): Promise<{ driver: string; tripId: string }> {
    const driver = await tokenFor('dan', ['driver']);
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({
        plate: '9811BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
      .expect(201);
    const trip = await api('post', '/trips', driver)
      .send({
        vehicleId: (vehicle.body as { id: string }).id,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        offeredSeats: 3,
        maxDetourMin,
      })
      .expect(201);
    return { driver, tripId: (trip.body as { id: string }).id };
  }

  async function requestFrom(
    name: string,
    tripId: string,
    pickupLocation: unknown,
  ): Promise<{ passenger: string; id: string }> {
    const passenger = await tokenFor(name, ['passenger']);
    const created = await api('post', `/trips/${tripId}/requests`, passenger)
      .send({ direction: 'to-campus', pickupLocation, pickupName: name })
      .expect(201);
    return { passenger, id: (created.body as RequestBody).id };
  }

  async function pickupAtOf(token: string, requestId: string): Promise<Date> {
    const found = await api('get', `/requests/${requestId}`, token).expect(200);
    return new Date((found.body as RequestBody).pickupAt);
  }

  function pickupCount(tripId: string): Promise<number> {
    return dataSource
      .query<{ count: number }[]>(
        'SELECT COUNT(*)::int AS count FROM trip_pickups WHERE trip_id = $1',
        [tripId],
      )
      .then(([row]) => row.count);
  }

  it('publishes picking up on the route, 500 m by default or the distance chosen', async () => {
    const { driver, tripId } = await driverWithTrip(10);
    const published = await api('get', `/trips/${tripId}`, driver).expect(200);
    expect(published.body).toMatchObject({
      pickupMode: 'on_route',
      maxDetourM: 500,
    });

    const vehicles = await api('get', '/vehicles', driver).expect(200);
    const [{ id: vehicleId }] = vehicles.body as { id: string }[];
    const trip = (overrides: Record<string, unknown>) =>
      api('post', '/trips', driver).send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        offeredSeats: 2,
        ...overrides,
      });

    const chosen = await trip({ maxDetourM: 300 }).expect(201);
    expect(chosen.body).toMatchObject({ maxDetourM: 300 });
    // El Gemelo Digital recibe el estado completo, con cómo recoge
    const [event] = await dataSource.query<
      { payload: Record<string, unknown> }[]
    >(
      `SELECT payload FROM events WHERE type = 'trip.published' AND source_entity_id = $1`,
      [(chosen.body as { id: string }).id],
    );
    expect(event.payload).toMatchObject({
      pickupMode: 'on_route',
      maxDetourM: 300,
    });
    // Solo 300, 500 o 1000 m; en puntos, con sus paradas (pickup-stops.e2e)
    await trip({ maxDetourM: 700 }).expect(400);
    await trip({ pickupMode: 'stops' }).expect(400);
  });

  it('refuses a passenger whose stop alone exceeds the budget', async () => {
    const { driver, tripId } = await driverWithTrip(1);
    const pia = await requestFrom('pia', tripId, NEAR_CAMPUS);

    const response = await api('post', `/requests/${pia.id}/accept`, driver)
      .send()
      .expect(409);

    expect(response.body).toMatchObject({ code: 'DETOUR_BUDGET_EXCEEDED' });
    expect(await pickupCount(tripId)).toBe(0);
  });

  it('accepts a passenger at the driver departure point: it is not a stop', async () => {
    const { driver, tripId } = await driverWithTrip(1);
    const pia = await requestFrom('pia', tripId, ALMERIA_CENTRE);

    await api('post', `/requests/${pia.id}/accept`, driver).send().expect(200);

    expect(await pickupCount(tripId)).toBe(1);
  });

  it('moves a later pickup when an earlier one is accepted, and back when it leaves', async () => {
    const { driver, tripId } = await driverWithTrip(30);
    const pia = await requestFrom('pia', tripId, NEAR_CAMPUS);
    await api('post', `/requests/${pia.id}/accept`, driver).send().expect(200);
    const piaAlone = await pickupAtOf(pia.passenger, pia.id);

    const leo = await requestFrom('leo', tripId, NEAR_START);
    await api('post', `/requests/${leo.id}/accept`, driver).send().expect(200);

    // Leo va antes: Pía se recoge más tarde (su tramo y su parada)
    const piaAfterLeo = await pickupAtOf(pia.passenger, pia.id);
    expect(piaAfterLeo.getTime()).toBeGreaterThan(piaAlone.getTime());
    expect((await pickupAtOf(leo.passenger, leo.id)).getTime()).toBeLessThan(
      piaAfterLeo.getTime(),
    );

    await api('post', `/requests/${leo.id}/cancel`, leo.passenger)
      .send()
      .expect(200);

    expect(await pickupCount(tripId)).toBe(1);
    expect((await pickupAtOf(pia.passenger, pia.id)).getTime()).toBeLessThan(
      piaAfterLeo.getTime(),
    );
  });
});
