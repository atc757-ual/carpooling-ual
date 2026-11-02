import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { EventsService } from '../src/events/events.service';
import { RequestStatsService } from '../src/modules/requests/request-stats.service';
import { TripStatsService } from '../src/modules/trips/trip-stats.service';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Resumen en vivo y eventos para la pantalla del Gemelo Digital del panel. Los
// usuarios llevan el prefijo EMAIL_PREFIX; los eventos del test, una entidad
// de origen inventada. Todo se borra al terminar
const EMAIL_PREFIX = 'admin-overview-e2e-';
const PASSWORD = 'secret-password';

interface Overview {
  tripsPublishedToday: number;
  tripsInProgress: number;
  seatsOffered: number;
  seatsTaken: number;
  pendingRequests: number;
}

describe('Admin overview API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let adminToken: string;
  const sourceEntityId = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    ({ token: adminToken } = await account('admin', ['passenger'], true));
  });

  afterEach(async () => {
    await dataSource.query('DELETE FROM events WHERE source_entity_id = $1', [
      sourceEntityId,
    ]);
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function account(
    name: string,
    profiles: string[],
    isAdmin = false,
  ): Promise<{ id: string; token: string }> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    const id = await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
    if (isAdmin) {
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [id],
      );
    }
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return {
      id,
      token: (response.body as { accessToken: string }).accessToken,
    };
  }

  function api(path: string, token = adminToken): request.Test {
    return request(app.getHttpServer())
      .get(`/api/admin${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function overview(): Promise<Overview> {
    return (await api('/overview').expect(200)).body as Overview;
  }

  it('rejects users without the admin profile (403)', async () => {
    const { token } = await account('pia', ['passenger']);

    await api('/overview', token).expect(403);
    await api('/events', token).expect(403);
    await api(`/events/${randomUUID()}`, token).expect(403);
  });

  it('returns the overview as whole counts', async () => {
    const body = await overview();

    expect(body).toMatchObject({ '@type': 'PlatformOverview' });
    for (const key of [
      'tripsPublishedToday',
      'tripsInProgress',
      'seatsOffered',
      'seatsTaken',
      'pendingRequests',
    ] as const) {
      expect(Number.isInteger(body[key]) && body[key] >= 0).toBe(true);
    }
  });

  // Las cuentas, dentro de una transacción con una foto fija de la base de
  // datos (REPEATABLE READ): los viajes que otros tests crean o borran a la
  // vez no cambian el resultado. Al terminar se deshace
  it('counts the trips of today, the seats and the pending requests', async () => {
    const dan = await account('dan', ['driver']);
    const pia = await account('pia', ['passenger']);
    const tripStats = app.get(TripStatsService);
    const requestStats = app.get(RequestStatsService);
    const runner = dataSource.createQueryRunner();
    await runner.startTransaction('REPEATABLE READ');
    try {
      const { manager } = runner;
      const count = async () => ({
        trips: await tripStats.overview(manager),
        pending: await requestStats.countPending(manager),
      });
      const before = await count();
      const [vehicle]: { id: string }[] = await manager.query(
        `INSERT INTO vehicles (driver_id, plate, capacity)
         VALUES ($1, $2, 4) RETURNING id`,
        [dan.id, `${Math.floor(1000 + Math.random() * 8999)}XYZ`],
      );
      const [trip]: { id: string }[] = await manager.query(
        `INSERT INTO trips (driver_id, vehicle_id, origin, destination,
                            departure_at, offered_seats, available_seats, status)
         VALUES ($1, $2, 'POINT(-2.4637 36.8381)', 'POINT(-2.4058 36.8297)',
                 now() + interval '1 day', 3, 1, 'confirmed') RETURNING id`,
        [dan.id, vehicle.id],
      );
      await manager.query(
        'INSERT INTO requests (trip_id, passenger_id) VALUES ($1, $2)',
        [trip.id, pia.id],
      );

      const after = await count();

      expect(after.trips.publishedToday - before.trips.publishedToday).toBe(1);
      expect(after.trips.inProgress - before.trips.inProgress).toBe(0);
      expect(after.trips.seatsOffered - before.trips.seatsOffered).toBe(3);
      expect(after.trips.seatsTaken - before.trips.seatsTaken).toBe(2);
      expect(after.pending - before.pending).toBe(1);
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
  });

  it('lists the latest events by type without payload and shows one with it', async () => {
    const events = app.get(EventsService);
    const id = await dataSource.transaction((manager) =>
      events.record(manager, {
        type: 'coverage.gap_reported',
        sourceEntityId,
        payload: { zone: 'outside' },
      }),
    );

    const list = await api('/events?type=coverage.gap_reported&limit=5').expect(
      200,
    );
    const [first] = list.body as { id: string; payload?: unknown }[];
    expect(first.id).toBe(id);
    expect(first.payload).toBeUndefined();
    expect(list.headers['x-total-count']).toEqual(expect.any(String));

    const detail = await api(`/events/${id}`).expect(200);
    expect(detail.body).toMatchObject({
      '@type': 'DomainEvent',
      type: 'coverage.gap_reported',
      version: 1,
      payload: { zone: 'outside' },
    });

    await api('/events?type=user.flew').expect(400);
    const missing = await api(`/events/${randomUUID()}`).expect(404);
    expect((missing.body as { code: string }).code).toBe('EVENT_NOT_FOUND');
  });
});
