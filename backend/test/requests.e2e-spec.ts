import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { deleteTestUsers } from './support/cleanup';
import { registerUser } from './support/accounts';

// Solicitudes de plaza (RF-08 a RF-10) de punta a punta por HTTP. Los usuarios
// llevan el prefijo EMAIL_PREFIX; en afterEach se borran sus eventos, viajes
// (las solicitudes caen en cascada) y usuarios
const EMAIL_PREFIX = 'requests-e2e-';
const PASSWORD = 'secret-password';
const UAL_CAMPUS = { type: 'Point', coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = { type: 'Point', coordinates: [-2.4637, 36.8381] };

describe('Seat requests API (e2e)', () => {
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

  // Conductor listo con un viaje publicado de offeredSeats plazas
  async function driverWithTrip(
    offeredSeats = 2,
    driverName = 'dan',
    plate = '9801BCD',
  ): Promise<{ driver: string; tripId: string }> {
    const driver = await tokenFor(driverName, ['driver']);
    await api('put', '/users/me/driver-declaration', driver).expect(200);
    const vehicle = await api('post', '/vehicles', driver)
      .send({
        plate,
        capacity: 4,
        brand: 'Seat',
        model: 'Ibiza',
        color: 'blue',
        engine: 'hybrid',
      })
      .expect(201);
    const trip = await api('post', '/trips', driver)
      .send({
        vehicleId: (vehicle.body as { id: string }).id,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        departureAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        offeredSeats,
      })
      .expect(201);
    return { driver, tripId: (trip.body as { id: string }).id };
  }

  async function requestSeat(
    passenger: string,
    tripId: string,
  ): Promise<{ id: string; href: string }> {
    const response = await api(
      'post',
      `/trips/${tripId}/requests`,
      passenger,
    ).expect(201);
    return response.body as { id: string; href: string };
  }

  it('full flow: request → accept (trip confirmed, plate visible) → cancel (trip reopened)', async () => {
    const { driver, tripId } = await driverWithTrip(2);
    const pia = await tokenFor('pia', ['passenger']);

    const created = await api('post', `/trips/${tripId}/requests`, pia).expect(
      201,
    );
    const seatRequest = created.body as {
      id: string;
      passenger: { id: string };
    };
    expect(created.body).toEqual({
      '@type': 'SeatRequest',
      id: seatRequest.id,
      href: `/api/requests/${seatRequest.id}`,
      trip: { id: tripId, href: `/api/trips/${tripId}` },
      passenger: { id: seatRequest.passenger.id, name: 'pia' },
      status: 'pending',
      seats: 1,
      isPriority: false,
      requestedAt: expect.any(String) as string,
      answeredAt: null,
      cancelledAt: null,
      vehiclePlate: null,
    });
    expect(created.headers.location).toBe(`/api/requests/${seatRequest.id}`);

    const accepted = await api(
      'post',
      `/requests/${seatRequest.id}/accept`,
      driver,
    ).expect(200);
    expect(accepted.body).toMatchObject({
      status: 'accepted',
      vehiclePlate: '9801BCD',
    });
    const confirmedTrip = await api('get', `/trips/${tripId}`, pia).expect(200);
    expect(confirmedTrip.body).toMatchObject({
      status: 'confirmed',
      availableSeats: 1,
    });

    await api('post', `/requests/${seatRequest.id}/cancel`, pia).expect(200);
    const reopenedTrip = await api('get', `/trips/${tripId}`, pia).expect(200);
    expect(reopenedTrip.body).toMatchObject({
      status: 'published',
      availableSeats: 2,
    });
  });

  it('returns 409 TOO_MANY_PENDING_REQUESTS after three overlapping requests', async () => {
    const passenger = await tokenFor('pia', ['passenger']);
    const trips = await Promise.all(
      ['dan-a', 'dan-b', 'dan-c', 'dan-d'].map((name, index) =>
        driverWithTrip(2, name, `98${index}1BCD`),
      ),
    );
    for (const { tripId } of trips.slice(0, 3)) {
      await requestSeat(passenger, tripId);
    }

    const response = await api(
      'post',
      `/trips/${trips[3].tripId}/requests`,
      passenger,
    ).expect(409);

    expect(response.body).toMatchObject({ code: 'TOO_MANY_PENDING_REQUESTS' });
  });

  it('requests several seats: they are taken and given back together', async () => {
    const { driver, tripId } = await driverWithTrip(3);
    const pia = await tokenFor('pia', ['passenger']);
    const leo = await tokenFor('leo', ['passenger']);

    const created = await api('post', `/trips/${tripId}/requests`, pia)
      .send({ seats: 2 })
      .expect(201);
    const { id, seats } = created.body as { id: string; seats: number };
    expect(seats).toBe(2);
    await api('post', `/requests/${id}/accept`, driver).expect(200);
    const trip = await api('get', `/trips/${tripId}`, pia).expect(200);
    expect(trip.body).toMatchObject({ availableSeats: 1 });

    // Quedan 1: otras 2 no caben
    const full = await api('post', `/trips/${tripId}/requests`, leo)
      .send({ seats: 2 })
      .expect(409);
    expect(full.body).toMatchObject({ code: 'TRIP_FULL' });

    await api('post', `/requests/${id}/cancel`, pia).expect(200);
    const reopened = await api('get', `/trips/${tripId}`, pia).expect(200);
    expect(reopened.body).toMatchObject({
      status: 'published',
      availableSeats: 3,
    });
  });

  it('validates the seats of a request (1 to 4)', async () => {
    const { tripId } = await driverWithTrip(4);
    const pia = await tokenFor('pia', ['passenger']);

    await api('post', `/trips/${tripId}/requests`, pia)
      .send({ seats: 5 })
      .expect(400);
    await api('post', `/trips/${tripId}/requests`, pia)
      .send({ seats: 0 })
      .expect(400);
  });

  it('answers 409 TRIP_FULL when there are no seats left', async () => {
    const { driver, tripId } = await driverWithTrip(1);
    const pia = await tokenFor('pia', ['passenger']);
    const leo = await tokenFor('leo', ['passenger']);
    const first = await requestSeat(pia, tripId);
    await api('post', `/requests/${first.id}/accept`, driver).expect(200);

    const response = await api('post', `/trips/${tripId}/requests`, leo).expect(
      409,
    );

    expect(response.body).toMatchObject({ code: 'TRIP_FULL' });
  });

  it('lets the driver list the requests of the trip, with pagination headers', async () => {
    const { driver, tripId } = await driverWithTrip(3);
    await requestSeat(await tokenFor('pia', ['passenger']), tripId);
    await requestSeat(await tokenFor('leo', ['passenger']), tripId);

    const response = await api(
      'get',
      `/trips/${tripId}/requests?limit=1`,
      driver,
    ).expect(200);

    expect(response.headers['x-total-count']).toBe('2');
    expect(response.headers['x-result-count']).toBe('1');
  });

  it('lets the passenger list their requests', async () => {
    const { tripId } = await driverWithTrip();
    const pia = await tokenFor('pia', ['passenger']);
    await requestSeat(pia, tripId);

    const response = await api('get', '/users/me/requests', pia).expect(200);

    expect(response.body).toMatchObject([
      { '@type': 'SeatRequest', trip: { id: tripId } },
    ]);
  });

  it('keeps requests private: a stranger gets 404', async () => {
    const { tripId } = await driverWithTrip();
    const pia = await tokenFor('pia', ['passenger']);
    const sam = await tokenFor('sam', ['passenger']);
    const seatRequest = await requestSeat(pia, tripId);

    const response = await api(
      'get',
      seatRequest.href.replace('/api', ''),
      sam,
    ).expect(404);

    expect(response.body).toMatchObject({ code: 'REQUEST_NOT_FOUND' });
  });

  it('checks the profile of each action', async () => {
    const { driver, tripId } = await driverWithTrip();
    const pia = await tokenFor('pia', ['passenger']);
    const seatRequest = await requestSeat(pia, tripId);

    const passengerAccepts = await api(
      'post',
      `/requests/${seatRequest.id}/accept`,
      pia,
    ).expect(403);
    const driverRequests = await api(
      'post',
      `/trips/${tripId}/requests`,
      driver,
    ).expect(403);

    expect(passengerAccepts.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
    expect(driverRequests.body).toMatchObject({ code: 'PROFILE_REQUIRED' });
  });

  it('rejects a request and does not accept it afterwards', async () => {
    const { driver, tripId } = await driverWithTrip();
    const pia = await tokenFor('pia', ['passenger']);
    const seatRequest = await requestSeat(pia, tripId);

    const rejected = await api(
      'post',
      `/requests/${seatRequest.id}/reject`,
      driver,
    ).expect(200);
    const acceptAfter = await api(
      'post',
      `/requests/${seatRequest.id}/accept`,
      driver,
    ).expect(409);

    expect(rejected.body).toMatchObject({ status: 'rejected' });
    expect(acceptAfter.body).toMatchObject({
      code: 'INVALID_REQUEST_TRANSITION',
    });
  });
});
