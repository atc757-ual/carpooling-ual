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
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture } from './support/trips';
import { registerUser } from './support/accounts';

// Avisos dentro de la aplicación (RF-19) de punta a punta. Los usuarios
// llevan el prefijo EMAIL_PREFIX y se borran con todo lo suyo
const EMAIL_PREFIX = 'notifications-e2e-';
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

describe('Notifications API (e2e)', () => {
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

  function api(method: 'get' | 'post', path: string, token: string) {
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .set('Authorization', `Bearer ${token}`);
  }

  async function sessionFor(
    name: string,
    profiles: string[] = ['passenger'],
  ): Promise<Session> {
    const email = `${EMAIL_PREFIX}${name}@ual.es`;
    await registerUser(app, {
      name,
      email,
      password: PASSWORD,
      profiles,
    });
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    const body = response.body as { accessToken: string; user: { id: string } };
    return { id: body.user.id, accessToken: body.accessToken };
  }

  // dan publica un viaje y pia y leo piden plaza: dan tiene dos avisos
  async function driverWithTwoNotices() {
    const dan = await sessionFor('dan', ['driver']);
    const usersService = app.get(UsersService);
    await usersService.declareDriverLicense(dan.id);
    const vehicle = await app.get(VehiclesService).register(dan.id, {
      plate: '9923BCD',
      capacity: 4,
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
    });
    const { trip } = await app.get(TripsService).publish(dan.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: publishableDeparture(),
      offeredSeats: 2,
    });
    const pia = await sessionFor('pia');
    const leo = await sessionFor('leo');
    const requestsService = app.get(RequestsService);
    const { request: piaRequest } = await requestsService.request(
      pia.id,
      trip.id,
    );
    await requestsService.request(leo.id, trip.id);
    return { dan, pia, tripId: trip.id, piaRequestId: piaRequest.id };
  }

  it('lists my notifications, the newest first, with links and the unread count', async () => {
    const { dan, tripId, piaRequestId } = await driverWithTwoNotices();

    const response = await api(
      'get',
      '/users/me/notifications?isRead=false',
      dan.accessToken,
    ).expect(200);

    expect(response.headers['x-total-count']).toBe('2');
    const notices = response.body as { request: { id: string } }[];
    expect(notices[1]).toEqual({
      '@type': 'Notification',
      id: expect.any(String) as string,
      type: 'request_received',
      trip: { id: tripId, href: `/api/trips/${tripId}` },
      request: { id: piaRequestId, href: `/api/requests/${piaRequestId}` },
      incident: null,
      isRead: false,
      readAt: null,
      createdAt: expect.any(String) as string,
    });
  });

  it('marks one as read; a notification of someone else is not found', async () => {
    const { dan, pia } = await driverWithTwoNotices();
    const list = await api('get', '/users/me/notifications', dan.accessToken);
    const [latest] = list.body as { id: string }[];

    const read = await api(
      'post',
      `/notifications/${latest.id}/read`,
      dan.accessToken,
    ).expect(200);
    const notMine = await api(
      'post',
      `/notifications/${latest.id}/read`,
      pia.accessToken,
    ).expect(404);
    const unread = await api(
      'get',
      '/users/me/notifications?isRead=false',
      dan.accessToken,
    ).expect(200);

    const alreadyRead = await api(
      'get',
      '/users/me/notifications?isRead=true',
      dan.accessToken,
    ).expect(200);

    expect(read.body).toMatchObject({ id: latest.id, isRead: true });
    expect(notMine.body).toMatchObject({ code: 'NOTIFICATION_NOT_FOUND' });
    expect(unread.headers['x-total-count']).toBe('1');
    expect(alreadyRead.body).toMatchObject([{ id: latest.id }]);
  });

  it('marks all as read', async () => {
    const { dan } = await driverWithTwoNotices();

    await api('post', '/users/me/notifications/read', dan.accessToken).expect(
      204,
    );

    const unread = await api(
      'get',
      '/users/me/notifications?isRead=false',
      dan.accessToken,
    ).expect(200);
    expect(unread.headers['x-total-count']).toBe('0');
  });

  it('validates isRead and the id, and requires a token', async () => {
    const pia = await sessionFor('pia');

    const badFilter = await api(
      'get',
      '/users/me/notifications?isRead=yes',
      pia.accessToken,
    ).expect(400);
    const badId = await api(
      'post',
      '/notifications/not-a-uuid/read',
      pia.accessToken,
    ).expect(400);
    await request(app.getHttpServer())
      .get('/api/users/me/notifications')
      .expect(401);

    expect(badFilter.body).toMatchObject({ fields: [{ field: 'isRead' }] });
    expect(badId.body).toMatchObject({ fields: [{ field: 'id' }] });
  });
});
