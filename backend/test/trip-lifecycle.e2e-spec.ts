import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { EVENT_VERSIONS } from '../src/events/event-versions';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';
import { registerUser } from './support/accounts';

// El ciclo completo de un viaje compartido por HTTP (RF-04 a RF-11):
// publicar → pedir plaza → aceptar → iniciar → finalizar. Los usuarios llevan
// el prefijo EMAIL_PREFIX; se borran con sus viajes, solicitudes y eventos
const EMAIL_PREFIX = 'lifecycle-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };

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

  // Conductor listo con un viaje publicado que sale dentro de esos minutos
  async function driverWithTrip(
    minutesToDeparture: number,
  ): Promise<{ driver: string; tripId: string; vehicleId: string }> {
    const driver = await tokenFor('dan', ['driver']);
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({
        plate: '9901BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
      .expect(201);
    const vehicleId = (vehicle.body as { id: string }).id;
    const trip = await api('post', '/trips', driver)
      .send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: publishableDeparture().toISOString(),
        offeredSeats: 2,
      })
      .expect(201);
    const tripId = (trip.body as { id: string }).id;
    // Publicado con la antelación mínima y movido a la salida pedida
    await setDepartureIn(dataSource, tripId, minutesToDeparture);
    return { driver, tripId, vehicleId };
  }

  it('full cycle: publish → request → accept → start → finish', async () => {
    // Solicitudes antes del corte (10 min); después, la salida se acerca para iniciar
    const { driver, tripId, vehicleId } = await driverWithTrip(20);
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
    await setDepartureIn(dataSource, tripId, 5);

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

  it('stores how far from the destination the driver finished (trip.finished v2 or later)', async () => {
    const { driver, tripId } = await driverWithTrip(20);
    const pia = await tokenFor('pia', ['passenger']);
    const seatRequest = await api(
      'post',
      `/trips/${tripId}/requests`,
      pia,
    ).expect(201);
    await api(
      'post',
      `/requests/${(seatRequest.body as { id: string }).id}/accept`,
      driver,
    ).expect(200);
    await setDepartureIn(dataSource, tripId, 5);
    await api('post', `/trips/${tripId}/start`, driver).expect(200);

    const invalid = await api('post', `/trips/${tripId}/finish`, driver)
      .send({ position: { type: 'Point', coordinates: [200, 36.8] } })
      .expect(400);
    expect(invalid.body).toMatchObject({ '@type': 'ValidationError' });

    // Aún en Almería centro: unos 5 km del campus
    await api('post', `/trips/${tripId}/finish`, driver)
      .send({ position: ALMERIA_CENTRE })
      .expect(200);

    const [trip] = await dataSource.query<
      { finish_distance_m: number | null }[]
    >(`SELECT finish_distance_m FROM trips WHERE id = $1`, [tripId]);
    expect(trip.finish_distance_m).toBeGreaterThan(4000);
    expect(trip.finish_distance_m).toBeLessThan(7000);
    const [event] = await dataSource.query<
      { version: number; payload: { finishDistanceM: number } }[]
    >(
      `SELECT version, payload FROM events
        WHERE source_entity_id = $1 AND type = 'trip.finished'`,
      [tripId],
    );
    expect(event.version).toBe(EVENT_VERSIONS['trip.finished']);
    expect(event.payload.finishDistanceM).toBe(trip.finish_distance_m);
  });

  it('asks to renew the declarations older than a year before starting (trip.started v2 or later)', async () => {
    const { driver, tripId, vehicleId } = await driverWithTrip(20);
    const pia = await tokenFor('pia', ['passenger']);
    const seatRequest = await api(
      'post',
      `/trips/${tripId}/requests`,
      pia,
    ).expect(201);
    await api(
      'post',
      `/requests/${(seatRequest.body as { id: string }).id}/accept`,
      driver,
    ).expect(200);
    await setDepartureIn(dataSource, tripId, 5);
    // Las dos declaraciones se aceptaron hace 13 meses
    await dataSource.query(
      `UPDATE user_consents SET recorded_at = now() - interval '13 months'
        WHERE user_id = (SELECT driver_id FROM vehicles WHERE id = $1)
          AND type IN ('driver_declaration', 'vehicle_declaration')`,
      [vehicleId],
    );

    const driverExpired = await api(
      'post',
      `/trips/${tripId}/start`,
      driver,
    ).expect(409);
    expect(driverExpired.body).toMatchObject({
      code: 'DRIVER_DECLARATION_REQUIRED',
    });
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    const vehicleExpired = await api(
      'post',
      `/trips/${tripId}/start`,
      driver,
    ).expect(409);
    expect(vehicleExpired.body).toMatchObject({
      code: 'VEHICLE_DECLARATION_REQUIRED',
    });
    await api('put', `/vehicles/${vehicleId}/declaration`, driver)
      .send({})
      .expect(200);
    await api('post', `/trips/${tripId}/start`, driver).expect(200);

    const [event] = await dataSource.query<
      {
        version: number;
        payload: {
          driverDeclarationVersion: string;
          vehicleDeclarationVersion: string;
        };
      }[]
    >(
      `SELECT version, payload FROM events
        WHERE source_entity_id = $1 AND type = 'trip.started'`,
      [tripId],
    );
    expect(event.version).toBe(EVENT_VERSIONS['trip.started']);
    expect(event.payload).toMatchObject({
      driverDeclarationVersion: expect.stringMatching(/^\d+\.\d+$/) as string,
      vehicleDeclarationVersion: '1.0',
    });
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
