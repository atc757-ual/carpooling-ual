import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Aceptación automática (decidida con el autor el 15/11/2026): las
// solicitudes que caben en un viaje que la tiene se aceptan solas; las que
// no, quedan pendientes para el conductor
const EMAIL_PREFIX = 'auto-accept-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const NEAR_CAMPUS = { type: 'Point', coordinates: [-2.42, 36.832] };

describe('Auto accept (e2e)', () => {
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
    method: 'get' | 'post',
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

  // Un viaje al campus con aceptación automática y este desvío máximo
  async function autoAcceptTrip(
    maxDetourMin: number,
  ): Promise<{ driver: string; tripId: string; driverId: string }> {
    const driver = await tokenFor('dan', ['driver']);
    await request(app.getHttpServer())
      .put('/api/users/me/driver-declaration')
      .set('Authorization', `Bearer ${driver}`)
      .expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({
        plate: '9827BCD',
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
        autoAccept: true,
      })
      .expect(201);
    const body = trip.body as { id: string; autoAccept: boolean };
    expect(body.autoAccept).toBe(true);
    await dataSource.query(
      `UPDATE trips SET max_detour_min = $2 WHERE id = $1`,
      [body.id, maxDetourMin],
    );
    const [{ driver_id: driverId }] = await dataSource.query<
      { driver_id: string }[]
    >(`SELECT driver_id FROM trips WHERE id = $1`, [body.id]);
    return { driver, tripId: body.id, driverId };
  }

  async function requestFrom(
    tripId: string,
    pickupLocation: unknown,
  ): Promise<{ id: string; status: string }> {
    const passenger = await tokenFor('pia', ['passenger']);
    const created = await api('post', `/trips/${tripId}/requests`, passenger)
      .send({ direction: 'to-campus', pickupLocation, pickupName: 'Pía' })
      .expect(201);
    return created.body as { id: string; status: string };
  }

  function noticesOf(userId: string): Promise<string[]> {
    return dataSource
      .query<{ type: string }[]>(
        `SELECT type::text AS type FROM notifications WHERE user_id = $1 ORDER BY created_at`,
        [userId],
      )
      .then((rows) => rows.map(({ type }) => type));
  }

  it('accepts a request that fits and tells the driver someone joined', async () => {
    const { tripId, driverId } = await autoAcceptTrip(30);

    const created = await requestFrom(tripId, ALMERIA_CENTRE);

    expect(created.status).toBe('accepted');
    expect(await noticesOf(driverId)).toEqual(['passenger_joined']);
    const [trip] = await dataSource.query<
      { status: string; available_seats: number }[]
    >(`SELECT status, available_seats FROM trips WHERE id = $1`, [tripId]);
    expect(trip).toEqual({ status: 'confirmed', available_seats: 2 });
    // El Gemelo Digital sabe que el viaje acepta solo
    const [event] = await dataSource.query<
      { payload: Record<string, unknown>; version: number }[]
    >(
      `SELECT payload, version FROM events WHERE type = 'trip.published' AND source_entity_id = $1`,
      [tripId],
    );
    expect(event).toMatchObject({ payload: { autoAccept: true }, version: 4 });
  });

  it('leaves pending a request outside the detour, as if it were not automatic', async () => {
    const { tripId, driverId } = await autoAcceptTrip(1);

    const created = await requestFrom(tripId, NEAR_CAMPUS);

    expect(created.status).toBe('pending');
    expect(await noticesOf(driverId)).toEqual(['request_received']);
  });
});
