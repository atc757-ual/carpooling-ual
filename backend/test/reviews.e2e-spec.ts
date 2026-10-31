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
import { registerUser } from './support/accounts';
import { deleteTestUsers } from './support/cleanup';
import { publishableDeparture, setDepartureIn } from './support/trips';

const EMAIL_PREFIX = 'reviews-e2e-';
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

describe('Reputation & Reviews API (e2e)', () => {
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
    method: 'get' | 'post',
    path: string,
    token: string,
  ): request.Test {
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

  async function createFinishedTrip(
    driver: Session,
    passengers: Session[],
    plate = '9401BCD',
  ): Promise<string> {
    const usersService = app.get(UsersService);
    await usersService.declareDriverLicense(driver.id);
    const vehiclesService = app.get(VehiclesService);
    const existing = await vehiclesService.listByDriver(driver.id, {
      offset: 0,
      limit: 1,
    });
    const vehicle =
      existing.items[0] ??
      (await vehiclesService.register(driver.id, {
        plate,
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
      }));
    const tripsService = app.get(TripsService);
    const { trip } = await tripsService.publish(driver.id, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      originName: 'Almería centro',
      destinationName: 'Campus UAL',
      departureAt: publishableDeparture(),
      offeredSeats: 3,
    });
    const requestsService = app.get(RequestsService);
    for (const passenger of passengers) {
      const { request: seatRequest } = await requestsService.request(
        passenger.id,
        trip.id,
      );
      await requestsService.accept(driver.id, seatRequest.id);
    }
    await setDepartureIn(dataSource, trip.id, 5);
    await tripsService.start(driver.id, trip.id);
    await tripsService.finish(driver.id, trip.id);
    return trip.id;
  }

  it('notifies driver and accepted passengers with review_requested and lists pending reviews', async () => {
    const dan = await sessionFor('dan', ['driver']);
    const pia = await sessionFor('pia', ['passenger']);
    const tripId = await createFinishedTrip(dan, [pia]);

    const [danNotices, piaNotices, danPending, piaPending] = await Promise.all([
      api('get', '/users/me/notifications', dan.accessToken).expect(200),
      api('get', '/users/me/notifications', pia.accessToken).expect(200),
      api('get', '/users/me/pending-reviews', dan.accessToken).expect(200),
      api('get', '/users/me/pending-reviews', pia.accessToken).expect(200),
    ]);

    expect(danNotices.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'review_requested',
          trip: { id: tripId, href: `/api/trips/${tripId}` },
          request: null,
        }),
      ]),
    );
    expect(piaNotices.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'review_requested',
          trip: { id: tripId, href: `/api/trips/${tripId}` },
        }),
      ]),
    );
    expect(danPending.body).toEqual([
      expect.objectContaining({
        '@type': 'PendingReviewTrip',
        myRole: 'driver',
        trip: expect.objectContaining({ id: tripId }) as unknown,
        targets: [
          expect.objectContaining({
            id: pia.id,
            name: 'pia',
            role: 'passenger',
          }),
        ],
      }),
    ]);
    expect(piaPending.body).toEqual([
      expect.objectContaining({
        '@type': 'PendingReviewTrip',
        myRole: 'passenger',
        trip: expect.objectContaining({ id: tripId }) as unknown,
        targets: [
          expect.objectContaining({
            id: dan.id,
            name: 'dan',
            role: 'driver',
          }),
        ],
      }),
    ]);
  });

  it('implements double-blind publication: hidden until both review, then published without comment in events', async () => {
    const dan = await sessionFor('dan', ['driver']);
    const pia = await sessionFor('pia', ['passenger']);
    const tripId = await createFinishedTrip(dan, [pia]);

    const first = await api('post', `/trips/${tripId}/reviews`, pia.accessToken)
      .send({
        targetId: dan.id,
        rating: 5,
        comment: 'Conductor muy puntual y amable.',
      })
      .expect(201);

    expect(first.body).toMatchObject({
      '@type': 'Review',
      targetRole: 'driver',
      rating: 5,
      comment: 'Conductor muy puntual y amable.',
      isPublished: false,
      publishedAt: null,
    });

    const receivedBeforeSecond = await api(
      'get',
      '/users/me/reviews?direction=received&role=driver',
      dan.accessToken,
    ).expect(200);
    expect(receivedBeforeSecond.body).toEqual([]);

    const givenByPia = await api(
      'get',
      '/users/me/reviews?direction=given',
      pia.accessToken,
    ).expect(200);
    expect(givenByPia.body).toMatchObject([
      { id: (first.body as { id: string }).id, isPublished: false },
    ]);

    const second = await api(
      'post',
      `/trips/${tripId}/reviews`,
      dan.accessToken,
    )
      .send({
        targetId: pia.id,
        rating: 4,
        comment: 'Todo genial.',
      })
      .expect(201);

    expect(second.body).toMatchObject({
      '@type': 'Review',
      targetRole: 'passenger',
      rating: 4,
      isPublished: true,
    });

    const [danReceived, piaReceived, danPending] = await Promise.all([
      api(
        'get',
        '/users/me/reviews?direction=received&role=driver',
        dan.accessToken,
      ).expect(200),
      api(
        'get',
        '/users/me/reviews?direction=received&role=passenger',
        pia.accessToken,
      ).expect(200),
      api('get', '/users/me/pending-reviews', dan.accessToken).expect(200),
    ]);

    expect(danReceived.body).toMatchObject([
      {
        id: (first.body as { id: string }).id,
        rating: 5,
        targetRole: 'driver',
        isPublished: true,
      },
    ]);
    expect(piaReceived.body).toMatchObject([
      {
        id: (second.body as { id: string }).id,
        rating: 4,
        targetRole: 'passenger',
        isPublished: true,
      },
    ]);
    expect(danPending.body).toEqual([]);

    const events = await dataSource.query<
      { type: string; payload: Record<string, unknown> }[]
    >(
      `SELECT type, payload
         FROM events
        WHERE source_entity_id IN ($1, $2)
        ORDER BY occurred_at ASC`,
      [(first.body as { id: string }).id, (second.body as { id: string }).id],
    );
    expect(events.map(({ type }) => type)).toEqual([
      'review.created',
      'review.created',
      'review.published',
      'review.published',
    ]);
    for (const event of events) {
      expect(event.payload).not.toHaveProperty('comment');
    }
  });

  it('publishes an unanswered review when the 7-day window expires and shows the average only from 3 reviews', async () => {
    const dan = await sessionFor('dan', ['driver']);
    const pia = await sessionFor('pia', ['passenger']);
    const leo = await sessionFor('leo', ['passenger']);
    const sam = await sessionFor('sam', ['passenger']);

    const trip1 = await createFinishedTrip(dan, [pia], '9411BCD');
    await api('post', `/trips/${trip1}/reviews`, pia.accessToken)
      .send({ targetId: dan.id, rating: 5 })
      .expect(201);

    await dataSource.query(
      `UPDATE trips SET finished_at = now() - interval '8 days' WHERE id = $1`,
      [trip1],
    );

    const lateReply = await api(
      'post',
      `/trips/${trip1}/reviews`,
      dan.accessToken,
    )
      .send({ targetId: pia.id, rating: 5 })
      .expect(409);
    expect(lateReply.body).toMatchObject({ code: 'REVIEW_WINDOW_CLOSED' });

    const danReviewsAfterExpiry = await api(
      'get',
      '/users/me/reviews?direction=received&role=driver',
      dan.accessToken,
    ).expect(200);
    expect(danReviewsAfterExpiry.body).toHaveLength(1);

    const meAfterOne = await api('get', '/users/me', dan.accessToken).expect(
      200,
    );
    expect(meAfterOne.body).toMatchObject({
      ratings: {
        driver: { averageRating: null, ratingCount: 1 },
      },
    });

    const trip2 = await createFinishedTrip(dan, [leo, sam], '9412BCD');
    await api('post', `/trips/${trip2}/reviews`, leo.accessToken)
      .send({ targetId: dan.id, rating: 4 })
      .expect(201);
    await api('post', `/trips/${trip2}/reviews`, dan.accessToken)
      .send({ targetId: leo.id, rating: 5 })
      .expect(201);
    await api('post', `/trips/${trip2}/reviews`, sam.accessToken)
      .send({ targetId: dan.id, rating: 5 })
      .expect(201);
    await api('post', `/trips/${trip2}/reviews`, dan.accessToken)
      .send({ targetId: sam.id, rating: 5 })
      .expect(201);

    const meAfterThree = await api('get', '/users/me', dan.accessToken).expect(
      200,
    );
    expect(meAfterThree.body).toMatchObject({
      ratings: {
        driver: { averageRating: 4.67, ratingCount: 3 },
      },
    });
  });

  it('enforces REVIEW_NOT_ALLOWED (403) and REVIEW_ALREADY_EXISTS (409)', async () => {
    const dan = await sessionFor('dan', ['driver']);
    const pia = await sessionFor('pia', ['passenger']);
    const outsider = await sessionFor('out', ['passenger']);
    const tripId = await createFinishedTrip(dan, [pia]);

    const stranger = await api(
      'post',
      `/trips/${tripId}/reviews`,
      outsider.accessToken,
    )
      .send({ targetId: dan.id, rating: 5 })
      .expect(403);
    expect(stranger.body).toMatchObject({ code: 'REVIEW_NOT_ALLOWED' });

    await api('post', `/trips/${tripId}/reviews`, pia.accessToken)
      .send({ targetId: dan.id, rating: 5 })
      .expect(201);

    const duplicate = await api(
      'post',
      `/trips/${tripId}/reviews`,
      pia.accessToken,
    )
      .send({ targetId: dan.id, rating: 4 })
      .expect(409);
    expect(duplicate.body).toMatchObject({ code: 'REVIEW_ALREADY_EXISTS' });
  });
});
