import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';

// Otros viajes para el pasajero cuyo conductor canceló, durante 30 min y por
// prioridad: el que encaja al 100 % (±15 min, en su punto), los que salen a
// su hora (±20 min) y los demás de ese día. Solo consulta: la plaza la pide él
const EMAIL_PREFIX = 'relocation-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTE_MS = 60_000;

interface TripMatchBody {
  id: string;
}
interface OptionsBody {
  exactMatch: TripMatchBody | null;
  matches: TripMatchBody[];
  sameDayMatches: TripMatchBody[];
}

describe('Relocation options after the driver cancels (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  // Las 07:00 UTC dentro de 4 días: un día y una hora que no usan otros e2e
  // (corren a la vez en el CI) y con margen para otro viaje ese mismo día
  const day = new Date(Date.now() + 4 * DAY_MS);
  day.setUTCHours(7, 0, 0, 0);
  const at = (minutes: number): string =>
    new Date(day.getTime() + minutes * MINUTE_MS).toISOString();

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

  // Un conductor con su coche
  async function driver(
    name: string,
    plate: string,
  ): Promise<{ token: string; vehicleId: string }> {
    const token = await tokenFor(name, ['driver']);
    await api('put', '/users/me/driver-declaration', token).expect(200);
    const vehicle = await api('post', '/vehicles', token)
      .send({
        plate,
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

  // Un viaje de Almería al campus que sale a esos minutos de las 07:00 UTC
  async function publish(
    { token, vehicleId }: { token: string; vehicleId: string },
    minutes: number,
  ): Promise<string> {
    const trip = await api('post', '/trips', token)
      .send({
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: at(minutes),
        offeredSeats: 3,
      })
      .expect(201);
    return (trip.body as { id: string }).id;
  }

  // Pía pide plaza en el viaje de Dan a las 07:00 y Dan lo cancela
  async function cancelledSeat(): Promise<{
    passenger: string;
    requestId: string;
  }> {
    const dan = await driver('dan', '9827BCD');
    const tripId = await publish(dan, 0);
    const passenger = await tokenFor('pia', ['passenger']);
    const created = await api('post', `/trips/${tripId}/requests`, passenger)
      .send({
        direction: 'to-campus',
        pickupLocation: ALMERIA_CENTRE,
        pickupName: 'Puerta de Purchena',
      })
      .expect(201);
    const requestId = (created.body as { id: string }).id;
    await api('post', `/trips/${tripId}/cancel`, dan.token).expect(200);
    return { passenger, requestId };
  }

  async function optionsFor(
    passenger: string,
    requestId: string,
  ): Promise<OptionsBody> {
    const response = await api(
      'get',
      `/requests/${requestId}/relocation-options`,
      passenger,
    ).expect(200);
    expect(response.body).toMatchObject({ '@type': 'RelocationOptions' });
    return response.body as OptionsBody;
  }

  const idsOf = (matches: TripMatchBody[]): string[] =>
    matches.map(({ id }) => id);

  it('marks the requests of a cancelled trip as cancelled by the trip', async () => {
    const { passenger, requestId } = await cancelledSeat();

    const seat = await api('get', `/requests/${requestId}`, passenger).expect(
      200,
    );
    expect(seat.body).toMatchObject({
      status: 'cancelled',
      rejectionReason: 'trip_cancelled',
    });
  });

  it('gives the exact match apart, the ones on time and the rest of the day, requesting nothing', async () => {
    const { passenger, requestId } = await cancelledSeat();
    const eva = await driver('eva', '1234BBB');
    const flo = await driver('flo', '5678CCC');
    const exactId = await publish(eva, 5);
    const onTimeId = await publish(flo, 18);
    const laterId = await publish(eva, 300);

    const options = await optionsFor(passenger, requestId);

    expect(options.exactMatch?.id).toBe(exactId);
    expect(idsOf(options.matches)).toContain(onTimeId);
    expect(idsOf(options.matches)).not.toContain(exactId);
    expect(idsOf(options.sameDayMatches)).toContain(laterId);
    expect(idsOf(options.sameDayMatches)).not.toContain(onTimeId);
    // Solo consulta: Pía no tiene ninguna solicitud nueva
    const mine = await api('get', '/users/me/requests', passenger).expect(200);
    expect(mine.body).toHaveLength(1);
  });

  it('has no exact match when none leaves within ±15 min', async () => {
    const { passenger, requestId } = await cancelledSeat();
    const onTimeId = await publish(await driver('flo', '5678CCC'), 18);

    const options = await optionsFor(passenger, requestId);

    expect(options.exactMatch).toBeNull();
    expect(idsOf(options.matches)).toContain(onTimeId);
  });

  it('does not give options for a request the passenger cancelled', async () => {
    const dan = await driver('dan', '9827BCD');
    const tripId = await publish(dan, 0);
    const passenger = await tokenFor('pia', ['passenger']);
    const created = await api('post', `/trips/${tripId}/requests`, passenger)
      .send({
        direction: 'to-campus',
        pickupLocation: ALMERIA_CENTRE,
        pickupName: 'Puerta de Purchena',
      })
      .expect(201);
    const requestId = (created.body as { id: string }).id;
    await api('post', `/requests/${requestId}/cancel`, passenger).expect(200);

    const refused = await api(
      'get',
      `/requests/${requestId}/relocation-options`,
      passenger,
    ).expect(409);
    expect(refused.body).toMatchObject({ code: 'REQUEST_NOT_RELOCATABLE' });
  });

  it('does not give options 30 minutes after the cancellation', async () => {
    const { passenger, requestId } = await cancelledSeat();
    await dataSource.query(
      `UPDATE requests SET cancelled_at = now() - interval '31 minutes'
        WHERE id = $1`,
      [requestId],
    );

    const refused = await api(
      'get',
      `/requests/${requestId}/relocation-options`,
      passenger,
    ).expect(409);
    expect(refused.body).toMatchObject({ code: 'REQUEST_NOT_RELOCATABLE' });
  });
});
