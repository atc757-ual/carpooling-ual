import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Incidencias (RF-23, RF-24) de punta a punta por HTTP. Los usuarios llevan el
// prefijo EMAIL_PREFIX; se borran con sus viajes, solicitudes, incidencias y
// eventos
const EMAIL_PREFIX = 'incidents-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const BREAKDOWN = 'The car broke down on the way to the campus';

describe('Incidents API (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let plateNumber = 9930;

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
    const testUsers = `SELECT id FROM users WHERE email LIKE '${EMAIL_PREFIX}%'`;
    const testTrips = `SELECT id FROM trips WHERE driver_id IN (${testUsers})`;
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (${testTrips})
         OR source_entity_id IN
           (SELECT id FROM requests WHERE trip_id IN (${testTrips}))
         OR source_entity_id IN
           (SELECT id FROM incidents WHERE trip_id IN (${testTrips}))`,
    );
    await dataSource.query(`DELETE FROM trips WHERE id IN (${testTrips})`);
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${EMAIL_PREFIX}%`,
    ]);
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
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password: PASSWORD, profiles })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return (login.body as { accessToken: string }).accessToken;
  }

  // Conductor listo con un viaje publicado que sale en 10 minutos
  async function driverWithTrip(
    name: string,
  ): Promise<{ driver: string; tripId: string }> {
    const driver = await tokenFor(name, ['driver']);
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    plateNumber += 1;
    const vehicle = await api('post', '/vehicles', driver)
      .send({ plate: `${plateNumber}BCD`, capacity: 4 })
      .expect(201);
    const trip = await api('post', '/trips', driver)
      .send({
        vehicleId: (vehicle.body as { id: string }).id,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        offeredSeats: 2,
      })
      .expect(201);
    return { driver, tripId: (trip.body as { id: string }).id };
  }

  async function acceptedRequest(
    driver: string,
    passenger: string,
    tripId: string,
  ): Promise<string> {
    const created = await api(
      'post',
      `/trips/${tripId}/requests`,
      passenger,
    ).expect(201);
    const requestId = (created.body as { id: string }).id;
    await api('post', `/requests/${requestId}/accept`, driver).expect(200);
    return requestId;
  }

  it('full flow: breakdown → incident → the passenger gets priority in her next request', async () => {
    const { driver, tripId } = await driverWithTrip('dan');
    const pia = await tokenFor('pia', ['passenger']);
    await acceptedRequest(driver, pia, tripId);
    await api('post', `/trips/${tripId}/start`, driver).expect(200);

    const reported = await api('post', `/trips/${tripId}/incidents`, driver)
      .send({ category: 'technical', description: `  ${BREAKDOWN}  ` })
      .expect(201);

    expect(reported.body).toEqual({
      '@type': 'Incident',
      id: expect.any(String) as string,
      trip: { id: tripId, href: `/api/trips/${tripId}` },
      category: 'technical',
      description: BREAKDOWN,
      reportedAt: expect.any(String) as string,
    });
    expect(reported.headers.location).toBeUndefined();
    const cancelledTrip = await api('get', `/trips/${tripId}`, pia).expect(200);
    expect(cancelledTrip.body).toMatchObject({ status: 'cancelled' });

    const other = await driverWithTrip('eve');
    const next = await api(
      'post',
      `/trips/${other.tripId}/requests`,
      pia,
    ).expect(201);
    expect(next.body).toMatchObject({ isPriority: true });
  });

  it('lets an accepted passenger leave the trip: it goes on with her seat free', async () => {
    const { driver, tripId } = await driverWithTrip('dan');
    const pia = await tokenFor('pia', ['passenger']);
    const requestId = await acceptedRequest(driver, pia, tripId);
    await api('post', `/trips/${tripId}/start`, driver).expect(200);

    await api('post', `/trips/${tripId}/incidents`, pia)
      .send({ category: 'driver', description: 'The driver was rude to me' })
      .expect(201);

    const trip = await api('get', `/trips/${tripId}`, driver).expect(200);
    expect(trip.body).toMatchObject({
      status: 'in_progress',
      availableSeats: 2,
    });
    const seatRequest = await api('get', `/requests/${requestId}`, pia).expect(
      200,
    );
    expect(seatRequest.body).toMatchObject({ status: 'cancelled' });
  });

  it('validates the category and the description length', async () => {
    const { driver, tripId } = await driverWithTrip('dan');

    const response = await api('post', `/trips/${tripId}/incidents`, driver)
      .send({ category: 'weather', description: 'short' })
      .expect(400);

    const { fields } = response.body as { fields: { field: string }[] };
    expect(fields.map(({ field }) => field).sort()).toEqual([
      'category',
      'description',
    ]);
  });

  it('answers 409 TRIP_NOT_IN_PROGRESS before the trip starts', async () => {
    const { driver, tripId } = await driverWithTrip('dan');

    const response = await api('post', `/trips/${tripId}/incidents`, driver)
      .send({ category: 'technical', description: BREAKDOWN })
      .expect(409);

    expect(response.body).toMatchObject({ code: 'TRIP_NOT_IN_PROGRESS' });
  });

  it('answers 403 NOT_TRIP_PASSENGER to someone who is not on the trip', async () => {
    const { driver, tripId } = await driverWithTrip('dan');
    const pia = await tokenFor('pia', ['passenger']);
    await acceptedRequest(driver, pia, tripId);
    await api('post', `/trips/${tripId}/start`, driver).expect(200);
    const sam = await tokenFor('sam', ['passenger']);

    const response = await api('post', `/trips/${tripId}/incidents`, sam)
      .send({ category: 'other', description: BREAKDOWN })
      .expect(403);

    expect(response.body).toMatchObject({ code: 'NOT_TRIP_PASSENGER' });
  });
});
