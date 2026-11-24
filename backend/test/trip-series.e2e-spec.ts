import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import {
  localDateOf,
  moveToSeriesDate,
} from '../src/modules/trips/trip-series';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import {
  lockPlatformSettings,
  setMultiDayPublishing,
} from './support/platform-settings-lock';
import { publishableDeparture } from './support/trips';

// Publicar el mismo viaje varios días a la vez, de punta a punta: con el
// ajuste apagado o encendido, con la vuelta, todo o nada si un día choca y
// días que no valen. Los usuarios llevan el prefijo EMAIL_PREFIX; sus
// vehículos, viajes y eventos se borran con ellos
const EMAIL_PREFIX = 'trip-series-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

interface PublishedBody {
  id: string;
  departureAt: string;
  returnTrip: { id: string } | null;
  repeatedTrips: {
    date: string;
    trip: { id: string };
    returnTrip: { id: string } | null;
  }[];
}

describe('Trip series (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let plateNumber = 7400;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
  });

  // Cada test, con los ajustes en exclusiva y publicar varios días encendido;
  // al acabar, como la migración
  let releaseSettings: () => Promise<void>;

  beforeEach(async () => {
    releaseSettings = await lockPlatformSettings(dataSource);
    await setMultiDayPublishing(dataSource, true);
  });

  afterEach(async () => {
    await releaseSettings();
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  async function readyDriver(): Promise<{ token: string; vehicleId: string }> {
    const email = `${EMAIL_PREFIX}dan@ual.es`;
    await registerUser(app, {
      name: 'dan',
      email,
      password: PASSWORD,
      profiles: ['driver'],
    });
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const token = (login.body as { accessToken: string }).accessToken;
    await api('put', '/users/me/driver-declaration', token).expect(200);
    plateNumber += 1;
    const vehicle = await api('post', '/vehicles', token)
      .send({
        plate: `${plateNumber}KTV`,
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
      .expect(201);
    return { token, vehicleId: (vehicle.body as { id: string }).id };
  }

  function api(
    method: 'get' | 'post' | 'put',
    path: string,
    token: string,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  function publish(
    driver: { token: string; vehicleId: string },
    departureAt: Date,
    extra: object = {},
  ): request.Test {
    return api('post', '/trips', driver.token).send({
      vehicleId: driver.vehicleId,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      originName: 'Almería',
      destinationName: 'Campus UAL',
      departureAt: departureAt.toISOString(),
      offeredSeats: 2,
      ...extra,
    });
  }

  // El día (en España) a tantos días de la primera salida
  function dayAfter(first: Date, days: number): string {
    return localDateOf(new Date(first.getTime() + days * DAY_MS));
  }

  async function tripCount(): Promise<number> {
    const [{ count }] = await dataSource.query<{ count: string }[]>(
      `SELECT count(*) AS count FROM trips t JOIN users u ON u.id = t.driver_id
       WHERE u.email LIKE $1`,
      [`${EMAIL_PREFIX}%`],
    );
    return Number(count);
  }

  it('refuses other days while multi-day publishing is off', async () => {
    await setMultiDayPublishing(dataSource, false);
    const driver = await readyDriver();
    const first = publishableDeparture();

    const refused = await publish(driver, first, {
      repeatDates: [dayAfter(first, 2)],
    }).expect(409);

    expect((refused.body as { code: string }).code).toBe(
      'MULTI_DAY_PUBLISHING_DISABLED',
    );
    expect(await tripCount()).toBe(0);
  });

  it('publishes the trip and its return on every day, at the same time', async () => {
    const driver = await readyDriver();
    const first = publishableDeparture();
    const returnAt = new Date(first.getTime() + 4 * HOUR_MS);
    const days = [dayAfter(first, 2), dayAfter(first, 3)];

    const published = await publish(driver, first, {
      returnTrip: { departureAt: returnAt.toISOString(), offeredSeats: 3 },
      repeatDates: days,
    }).expect(201);

    const body = published.body as PublishedBody;
    expect(body.repeatedTrips.map(({ date }) => date)).toEqual(days);
    expect(body.repeatedTrips.every(({ returnTrip }) => returnTrip)).toBe(true);
    expect(await tripCount()).toBe(6);
    const second = await api(
      'get',
      `/trips/${body.repeatedTrips[0].trip.id}`,
      driver.token,
    ).expect(200);
    expect((second.body as { departureAt: string }).departureAt).toBe(
      moveToSeriesDate(first, first, days[0]).toISOString(),
    );
  });

  it('publishes none and says which day breaks a rule', async () => {
    const driver = await readyDriver();
    const first = publishableDeparture();
    const busyDay = dayAfter(first, 3);
    await publish(driver, moveToSeriesDate(first, first, busyDay)).expect(201);

    const refused = await publish(driver, first, {
      repeatDates: [dayAfter(first, 2), busyDay],
    }).expect(409);

    const error = refused.body as { code: string; message: string };
    expect(error.code).toBe('REPEAT_DATE_REJECTED');
    expect(error.message).toMatch(
      new RegExp(String.raw`^Repeat date ${busyDay} \(TRIP_OVERLAPS\)`),
    );
    expect(await tripCount()).toBe(1);
  });

  it('refuses days that are not valid', async () => {
    const driver = await readyDriver();
    const first = publishableDeparture();

    const tooFar = await publish(driver, first, {
      repeatDates: [dayAfter(first, 40)],
    }).expect(400);
    expect((tooFar.body as { code: string }).code).toBe('INVALID_REPEAT_DATES');
    await publish(driver, first, {
      repeatDates: [dayAfter(first, 2), dayAfter(first, 2)],
    }).expect(400);
    await publish(driver, first, { repeatDates: ['2/12/2026'] }).expect(400);
    expect(await tripCount()).toBe(0);
  });
});
