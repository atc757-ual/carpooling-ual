import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Ida y vuelta en un solo flujo (docs/diseno-modos-recogida-y-vuelta.md,
// §4.6): la vuelta es otro viaje al revés, en la misma transacción que la ida
const EMAIL_PREFIX = 'round-trip-e2e-';
const PASSWORD = 'secret-password';
const MINUTES = 60 * 1000;
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };

interface PublishedBody {
  id: string;
  origin: unknown;
  destination: unknown;
  offeredSeats: number;
  returnTrip: { id: string; href: string } | null;
}

describe('Publishing the outbound and the return trip (e2e)', () => {
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

  function api(method: 'get' | 'post' | 'put', path: string, token: string) {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  // Un conductor con su vehículo de 4 plazas que va del centro al parking P1
  // mañana a las 8 y, si se le pide, vuelve
  async function readyDriver(): Promise<{
    driver: string;
    campus: unknown;
    publish: (body: Record<string, unknown>) => request.Test;
    outboundAt: Date;
  }> {
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
    const driver = (login.body as { accessToken: string }).accessToken;
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({
        plate: '9813BCD',
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
        declarationVersion: '1.0',
      })
      .expect(201);
    const parking = await api('get', '/campus-parkings/p1', driver).expect(200);
    const campus = (parking.body as { location: unknown }).location;
    const outboundAt = new Date(Date.now() + 24 * 60 * MINUTES);
    return {
      driver,
      campus,
      outboundAt,
      publish: (body) =>
        api('post', '/trips', driver).send({
          vehicleId: (vehicle.body as { id: string }).id,
          origin: ALMERIA_CENTRE,
          destination: campus,
          originName: 'Almería centro',
          destinationName: 'Campus UAL · Parking P1',
          departureAt: outboundAt.toISOString(),
          offeredSeats: 3,
          ...body,
        }),
    };
  }

  function tripsOf(driver: string): Promise<{ id: string }[]> {
    return api('get', '/users/me/trips', driver)
      .expect(200)
      .then(({ body }) => body as { id: string }[]);
  }

  it('publishes the return trip, the other way round, with its own seats', async () => {
    const { driver, campus, publish, outboundAt } = await readyDriver();
    const returnAt = new Date(outboundAt.getTime() + 6 * 60 * MINUTES);

    const published = await publish({
      returnTrip: { departureAt: returnAt.toISOString(), offeredSeats: 2 },
    }).expect(201);

    const outbound = published.body as PublishedBody;
    expect(outbound.returnTrip).toEqual({
      id: expect.any(String) as string,
      href: `/api/trips/${outbound.returnTrip?.id}`,
    });
    const back = await api('get', `/trips/${outbound.returnTrip?.id}`, driver)
      .expect(200)
      .then(({ body }) => body as PublishedBody & Record<string, unknown>);
    expect(back).toMatchObject({
      origin: campus,
      destination: ALMERIA_CENTRE,
      originName: 'Campus UAL · Parking P1',
      destinationName: 'Almería centro',
      departureAt: returnAt.toISOString(),
      offeredSeats: 2,
      pickupMode: 'on_route',
    });
    expect(await tripsOf(driver)).toHaveLength(2);
  });

  it('publishes neither when the return trip breaks a rule', async () => {
    const { driver, publish, outboundAt } = await readyDriver();

    // Sale antes de que llegue la ida: se cruzan
    const overlapping = await publish({
      returnTrip: {
        departureAt: new Date(outboundAt.getTime() + 5 * MINUTES).toISOString(),
        offeredSeats: 2,
      },
    }).expect(409);
    expect(overlapping.body).toMatchObject({ code: 'RETURN_TRIP_REJECTED' });
    expect((overlapping.body as { message: string }).message).toContain(
      'TRIP_OVERLAPS',
    );

    // Más plazas de las que tiene el coche
    const tooManySeats = await publish({
      returnTrip: {
        departureAt: new Date(
          outboundAt.getTime() + 6 * 60 * MINUTES,
        ).toISOString(),
        offeredSeats: 5,
      },
    }).expect(400);
    expect(tooManySeats.body).toMatchObject({ code: 'RETURN_TRIP_REJECTED' });

    expect(await tripsOf(driver)).toHaveLength(0);
  });
});
