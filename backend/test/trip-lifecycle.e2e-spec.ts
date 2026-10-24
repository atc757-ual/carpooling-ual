import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// El ciclo completo de un viaje compartido por HTTP (RF-04 a RF-11):
// publicar → pedir plaza → aceptar → iniciar → finalizar. Los usuarios llevan
// el prefijo EMAIL_PREFIX; se borran con sus viajes, solicitudes y eventos
const EMAIL_PREFIX = 'lifecycle-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const MINUTE_MS = 60 * 1000;

describe('Trip lifecycle API (e2e)', () => {
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
    await registerUser(app.getHttpServer(), {
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

  // Conductor listo con un viaje publicado que sale dentro de esos minutos
  async function driverWithTrip(
    minutesToDeparture: number,
  ): Promise<{ driver: string; tripId: string; vehicleId: string }> {
    const driver = await tokenFor('dan', ['driver']);
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({ plate: '9901BCD', capacity: 4 })
      .expect(201);
    const vehicleId = (vehicle.body as { id: string }).id;
    const trip = await api('post', '/trips', driver)
      .send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: new Date(
          Date.now() + minutesToDeparture * MINUTE_MS,
        ).toISOString(),
        offeredSeats: 2,
      })
      .expect(201);
    return { driver, tripId: (trip.body as { id: string }).id, vehicleId };
  }

  it('full cycle: publish → request → accept → start → finish', async () => {
    const { driver, tripId, vehicleId } = await driverWithTrip(10);
    const pia = await tokenFor('pia', ['passenger']);
    const leo = await tokenFor('leo', ['passenger']);
    const accepted = await api('post', `/trips/${tripId}/requests`, pia).expect(
      201,
    );
    const pending = await api('post', `/trips/${tripId}/requests`, leo).expect(
      201,
    );
    await api(
      'post',
      `/requests/${(accepted.body as { id: string }).id}/accept`,
      driver,
    ).expect(200);

    const started = await api('post', `/trips/${tripId}/start`, driver).expect(
      200,
    );
    expect(started.body).toMatchObject({ status: 'in_progress' });
    const vehicleOnTrip = await api(
      'get',
      `/vehicles/${vehicleId}`,
      driver,
    ).expect(200);
    expect(vehicleOnTrip.body).toMatchObject({ status: 'on_trip' });
    const leoRequest = await api(
      'get',
      `/requests/${(pending.body as { id: string }).id}`,
      leo,
    ).expect(200);
    expect(leoRequest.body).toMatchObject({ status: 'rejected' });

    const finished = await api(
      'post',
      `/trips/${tripId}/finish`,
      driver,
    ).expect(200);
    expect(finished.body).toMatchObject({ status: 'finished' });
    const vehicleBack = await api(
      'get',
      `/vehicles/${vehicleId}`,
      driver,
    ).expect(200);
    expect(vehicleBack.body).toMatchObject({ status: 'available' });
  });

  it('answers 409 TRIP_NOT_STARTABLE_YET more than 30 minutes before the departure', async () => {
    const { driver, tripId } = await driverWithTrip(60);

    const response = await api('post', `/trips/${tripId}/start`, driver).expect(
      409,
    );

    expect(response.body).toMatchObject({ code: 'TRIP_NOT_STARTABLE_YET' });
  });

  it('only starts a trip with passengers (409 INVALID_TRIP_TRANSITION)', async () => {
    const { driver, tripId } = await driverWithTrip(10);

    const response = await api('post', `/trips/${tripId}/start`, driver).expect(
      409,
    );

    expect(response.body).toMatchObject({ code: 'INVALID_TRIP_TRANSITION' });
  });

  it('only lets the driver of the trip start it', async () => {
    const { tripId } = await driverWithTrip(10);
    const other = await tokenFor('oli', ['driver']);

    const response = await api('post', `/trips/${tripId}/start`, other).expect(
      403,
    );

    expect(response.body).toMatchObject({ code: 'NOT_TRIP_DRIVER' });
  });
});
