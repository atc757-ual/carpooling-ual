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

// Cancelaciones tardías del conductor y antelación mínima para publicar, de
// punta a punta. Los usuarios llevan el prefijo EMAIL_PREFIX; sus viajes,
// solicitudes, eventos y cancelaciones tardías se borran con ellos
const EMAIL_PREFIX = 'late-cancel-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const MINUTE_MS = 60 * 1000;

interface PublishingStatusBody {
  lateCancellations: number;
  publishingSuspendedUntil: string | null;
}

describe('Late cancellations (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let plateNumber = 9850;

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
    method: 'get' | 'post' | 'put' | 'patch',
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

  async function readyDriver(): Promise<{ token: string; vehicleId: string }> {
    const token = await tokenFor('dan', ['driver']);
    await api('put', '/users/me/driver-declaration', token).expect(200);
    plateNumber += 1;
    const vehicle = await api('post', '/vehicles', token)
      .send({
        plate: `${plateNumber}BCD`,
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
      })
      .expect(201);
    return { token, vehicleId: (vehicle.body as { id: string }).id };
  }

  function tripBody(vehicleId: string, departureAt: Date): object {
    return {
      vehicleId,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: departureAt.toISOString(),
      offeredSeats: 2,
    };
  }

  // Viaje publicado que sale en estos minutos; con passenger, además con esa
  // pasajera aceptada (confirmado)
  async function tripLeavingIn(
    driver: { token: string; vehicleId: string },
    minutes: number,
    passenger?: string,
  ): Promise<string> {
    const trip = await api('post', '/trips', driver.token)
      .send(tripBody(driver.vehicleId, publishableDeparture()))
      .expect(201);
    const tripId = (trip.body as { id: string }).id;
    if (passenger) {
      const created = await api('post', `/trips/${tripId}/requests`, passenger)
        .send({ seats: 1 })
        .expect(201);
      const requestId = (created.body as { id: string }).id;
      await api('post', `/requests/${requestId}/accept`, driver.token).expect(
        200,
      );
    }
    await setDepartureIn(dataSource, tripId, minutes);
    return tripId;
  }

  async function publishingStatus(
    token: string,
  ): Promise<PublishingStatusBody> {
    const response = await api(
      'get',
      '/users/me/publishing-status',
      token,
    ).expect(200);
    return response.body as PublishingStatusBody;
  }

  it('counts a cancellation with passengers less than 30 minutes before as late', async () => {
    const driver = await readyDriver();
    const pia = await tokenFor('pia', ['passenger']);
    const tripId = await tripLeavingIn(driver, 20, pia);

    await api('post', `/trips/${tripId}/cancel`, driver.token).expect(200);

    expect(await publishingStatus(driver.token)).toEqual({
      '@type': 'PublishingStatus',
      lateCancellations: 1,
      publishingSuspendedUntil: null,
    });
    const events = await dataSource.query<{ type: string }[]>(
      `SELECT type FROM events WHERE source_entity_id = $1`,
      [tripId],
    );
    expect(events.map(({ type }) => type)).toContain('trip.cancelled_late');
  });

  it('does not count it with time left or without passengers', async () => {
    const driver = await readyDriver();
    const pia = await tokenFor('pia', ['passenger']);
    const withTime = await tripLeavingIn(driver, 40, pia);
    const empty = await tripLeavingIn(driver, 10);

    await api('post', `/trips/${withTime}/cancel`, driver.token).expect(200);
    await api('post', `/trips/${empty}/cancel`, driver.token).expect(200);

    expect((await publishingStatus(driver.token)).lateCancellations).toBe(0);
  });

  it('suspends publishing for 7 days after 3 late cancellations in 30 days', async () => {
    const driver = await readyDriver();
    const pia = await tokenFor('pia', ['passenger']);
    for (let index = 0; index < 3; index += 1) {
      const tripId = await tripLeavingIn(driver, 10, pia);
      await api('post', `/trips/${tripId}/cancel`, driver.token).expect(200);
    }

    const status = await publishingStatus(driver.token);
    expect(status.lateCancellations).toBe(3);
    const until = new Date(status.publishingSuspendedUntil ?? 0).getTime();
    expect(
      Math.abs(until - (Date.now() + 7 * 24 * 60 * MINUTE_MS)),
    ).toBeLessThan(MINUTE_MS);

    const refused = await api('post', '/trips', driver.token)
      .send(tripBody(driver.vehicleId, publishableDeparture()))
      .expect(409);
    expect(refused.body).toMatchObject({ code: 'PUBLISHING_SUSPENDED' });
  });

  it('requires one hour to publish or to move the departure', async () => {
    const driver = await readyDriver();
    const soon = new Date(Date.now() + 50 * MINUTE_MS);

    const refused = await api('post', '/trips', driver.token)
      .send(tripBody(driver.vehicleId, soon))
      .expect(400);
    expect(refused.body).toMatchObject({ code: 'DEPARTURE_TOO_SOON' });

    const tripId = await tripLeavingIn(driver, 120);
    await api('patch', `/trips/${tripId}`, driver.token)
      .send({ departureAt: soon.toISOString() })
      .expect(400);
    // Cambiar solo las plazas de un viaje que sale pronto sigue permitido
    await setDepartureIn(dataSource, tripId, 40);
    await api('patch', `/trips/${tripId}`, driver.token)
      .send({ offeredSeats: 1 })
      .expect(200);
  });
});
