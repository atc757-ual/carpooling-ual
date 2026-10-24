import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

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
    await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
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

    const incident = reported.body as { id: string; reporter: { id: string } };
    expect(reported.body).toEqual({
      '@type': 'Incident',
      id: incident.id,
      href: `/api/incidents/${incident.id}`,
      trip: { id: tripId, href: `/api/trips/${tripId}` },
      reporter: { id: incident.reporter.id, name: 'dan', role: 'driver' },
      category: 'technical',
      description: BREAKDOWN,
      reportedAt: expect.any(String) as string,
      status: 'open',
      review: null,
    });
    expect(reported.headers.location).toBe(`/api/incidents/${incident.id}`);
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

  // CU-12: revisión por el administrador y quién ve cada incidencia
  describe('review by the administrator (CU-12)', () => {
    const RESOLUTION = 'The driver was contacted and the car repaired';

    // Administrador: el registro público no permite pedir ese perfil, así que
    // se le da en la base de datos antes de iniciar sesión
    async function adminToken(): Promise<string> {
      const email = `${EMAIL_PREFIX}ada@ual.es`;
      const id = await registerUser(app, {
        name: 'ada',
        email,
        password: PASSWORD,
        profiles: ['passenger'],
      });
      await dataSource.query(
        'INSERT INTO admin_profiles (user_id) VALUES ($1)',
        [id],
      );
      const login = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email, password: PASSWORD })
        .expect(200);
      return (login.body as { accessToken: string }).accessToken;
    }

    // Incidencia del conductor (dan) en un viaje en curso con una pasajera
    // aceptada (pia)
    async function reportedIncident() {
      const { driver, tripId } = await driverWithTrip('dan');
      const pia = await tokenFor('pia', ['passenger']);
      await acceptedRequest(driver, pia, tripId);
      await api('post', `/trips/${tripId}/start`, driver).expect(200);
      const reported = await api('post', `/trips/${tripId}/incidents`, driver)
        .send({ category: 'technical', description: BREAKDOWN })
        .expect(201);
      return {
        driver,
        pia,
        location: reported.headers.location,
        id: (reported.body as { id: string }).id,
      };
    }

    it('only the reporter and the administrators can see an incident', async () => {
      const { driver, pia, location } = await reportedIncident();
      const admin = await adminToken();
      const path = location.replace('/api', '');

      await api('get', path, driver).expect(200);
      await api('get', path, admin).expect(200);
      const hidden = await api('get', path, pia).expect(404);
      expect(hidden.body).toMatchObject({ code: 'INCIDENT_NOT_FOUND' });
    });

    it('lists my incidents', async () => {
      const { driver, id } = await reportedIncident();

      const response = await api('get', '/users/me/incidents', driver).expect(
        200,
      );

      expect(response.headers['x-total-count']).toBe('1');
      expect(response.body).toMatchObject([{ id, status: 'open' }]);
    });

    it('lets only the administrator list the incidents by status', async () => {
      const { driver, id } = await reportedIncident();
      const admin = await adminToken();

      const open = await api('get', '/incidents?status=open', admin).expect(
        200,
      );
      const forbidden = await api('get', '/incidents', driver).expect(403);

      expect((open.body as { id: string }[]).map((i) => i.id)).toContain(id);
      expect(forbidden.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
      await api('get', '/incidents?status=closed', admin).expect(400);
    });

    it('reviews an incident; the reporter sees the resolution; it cannot be reviewed again', async () => {
      const { driver, location, id } = await reportedIncident();
      const admin = await adminToken();

      const reviewed = await api('post', `/incidents/${id}/review`, admin)
        .send({ resolution: RESOLUTION })
        .expect(200);
      expect(reviewed.body).toMatchObject({
        status: 'reviewed',
        review: { resolution: RESOLUTION },
      });

      const seenByReporter = await api(
        'get',
        location.replace('/api', ''),
        driver,
      ).expect(200);
      expect(seenByReporter.body).toMatchObject({
        status: 'reviewed',
        review: { resolution: RESOLUTION },
      });

      const again = await api('post', `/incidents/${id}/review`, admin)
        .send({ resolution: RESOLUTION })
        .expect(409);
      expect(again.body).toMatchObject({ code: 'INCIDENT_ALREADY_REVIEWED' });
    });

    it('only an administrator reviews, with a resolution of 10 to 1000 characters', async () => {
      const { driver, id } = await reportedIncident();
      const admin = await adminToken();

      await api('post', `/incidents/${id}/review`, driver)
        .send({ resolution: RESOLUTION })
        .expect(403);
      const invalid = await api('post', `/incidents/${id}/review`, admin)
        .send({ resolution: 'ok' })
        .expect(400);
      expect(invalid.body).toMatchObject({
        fields: [{ field: 'resolution' }],
      });
    });
  });
});
