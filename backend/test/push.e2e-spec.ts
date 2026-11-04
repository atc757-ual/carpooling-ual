import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { RequestsService } from '../src/modules/requests/requests.service';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import {
  MemoryPushSender,
  SentPush,
} from '../src/shared/push/memory-push-sender';
import { PushSender } from '../src/shared/push/push-sender';
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture } from './support/trips';

const EMAIL_PREFIX = 'push-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};

interface Session {
  id: string;
  accessToken: string;
}

describe('Push notifications (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let sender: MemoryPushSender;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    dataSource = app.get(DataSource);
    sender = app.get(PushSender);
  });

  afterEach(async () => {
    sender.clear();
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
  });

  afterAll(async () => {
    await app.close();
  });

  function api(
    method: 'put' | 'delete' | 'post',
    path: string,
    session: Session,
  ): request.Test {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${session.accessToken}`);
  }

  async function sessionFor(
    name: string,
    profiles: string[],
  ): Promise<Session> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, { name, email, password: PASSWORD, profiles });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, accessToken: body.accessToken };
  }

  async function tokensOf(userId: string): Promise<string[]> {
    const rows = await dataSource.query<{ token: string }[]>(
      `SELECT token FROM push_tokens WHERE user_id = $1 ORDER BY token`,
      [userId],
    );
    return rows.map(({ token }) => token);
  }

  // Las push salen justo después de confirmarse la transacción
  async function waitForPush(count = 1): Promise<SentPush[]> {
    for (
      let attempt = 0;
      attempt < 50 && sender.sent.length < count;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return sender.sent;
  }

  async function publishedTrip(driver: Session): Promise<string> {
    await app.get(UsersService).declareDriverLicense(driver.id);
    const vehicle = await app.get(VehiclesService).register(driver.id, {
      plate: '9871PHT',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await app.get(TripsService).publish(driver.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      originName: 'Almería centro',
      destinationName: 'Campus UAL',
      departureAt: publishableDeparture(),
      offeredSeats: 3,
    });
    return trip.id;
  }

  it('registers, moves and removes the push tokens of a device', async () => {
    const [ana, bob] = await Promise.all([
      sessionFor('ana', ['passenger']),
      sessionFor('bob', ['passenger']),
    ]);

    await api('put', '/users/me/push-tokens', ana)
      .send({ token: 'device-1', platform: 'web' })
      .expect(204);
    await api('put', '/users/me/push-tokens', ana)
      .send({ token: 'device-1', platform: 'web' })
      .expect(204);
    expect(await tokensOf(ana.id)).toEqual(['device-1']);

    // Otra sesión en el mismo dispositivo: el token pasa a bob
    await api('put', '/users/me/push-tokens', bob)
      .send({ token: 'device-1', platform: 'android' })
      .expect(204);
    expect(await tokensOf(ana.id)).toEqual([]);
    expect(await tokensOf(bob.id)).toEqual(['device-1']);

    // Solo se quita el propio
    await api('delete', '/users/me/push-tokens?token=device-1', ana).expect(
      204,
    );
    expect(await tokensOf(bob.id)).toEqual(['device-1']);
    await api('delete', '/users/me/push-tokens?token=device-1', bob).expect(
      204,
    );
    expect(await tokensOf(bob.id)).toEqual([]);

    const invalid = await api('put', '/users/me/push-tokens', ana)
      .send({ token: 'device-2', platform: 'ios' })
      .expect(400);
    expect(invalid.body).toMatchObject({ '@type': 'ValidationError' });
  });

  it('tells the driver by push about a new request, and drops the expired tokens', async () => {
    const [dan, pia] = await Promise.all([
      sessionFor('dan', ['driver']),
      sessionFor('pia', ['passenger']),
    ]);
    const tripId = await publishedTrip(dan);
    for (const token of ['dan-web', 'dan-old']) {
      await api('put', '/users/me/push-tokens', dan)
        .send({ token, platform: 'web' })
        .expect(204);
    }
    sender.invalidTokens.add('dan-old');

    const { request: seatRequest } = await app
      .get(RequestsService)
      .request(pia.id, tripId);

    const [push] = await waitForPush();
    expect([...push.tokens].sort()).toEqual(['dan-old', 'dan-web']);
    expect(push.message).toEqual({
      title: 'Te han pedido plaza',
      body: 'Ábrela para aceptarla o rechazarla.',
      data: { type: 'request_received', tripId, requestId: seatRequest.id },
    });
    for (let attempt = 0; attempt < 50; attempt++) {
      if ((await tokensOf(dan.id)).length === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(await tokensOf(dan.id)).toEqual(['dan-web']);
  });

  it('tells who wrote in the chat, not what they wrote', async () => {
    const [dan, pia] = await Promise.all([
      sessionFor('dan', ['driver']),
      sessionFor('pia', ['passenger']),
    ]);
    await dataSource.query(`UPDATE users SET name = 'Pía Ruiz' WHERE id = $1`, [
      pia.id,
    ]);
    const tripId = await publishedTrip(dan);
    const requests = app.get(RequestsService);
    const { request: seatRequest } = await requests.request(pia.id, tripId);
    await requests.accept(dan.id, seatRequest.id);
    await api('put', '/users/me/push-tokens', dan)
      .send({ token: 'dan-web', platform: 'web' })
      .expect(204);
    sender.clear();

    await api('post', `/trips/${tripId}/messages`, pia)
      .send({ text: 'Mi portal es el 12' })
      .expect(201);

    const [push] = await waitForPush();
    expect(push.tokens).toEqual(['dan-web']);
    expect(push.message).toEqual({
      title: 'Pía R. te ha escrito',
      body: 'Abre el chat del viaje para leerlo.',
      data: { type: 'chat_message', tripId },
    });
    expect(JSON.stringify(push.message)).not.toContain('portal');
  });
});
