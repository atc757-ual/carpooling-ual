import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { CannotRequestOwnTripError } from '../src/modules/requests/errors/cannot-request-own-trip.error';
import { InvalidRequestTransitionError } from '../src/modules/requests/errors/invalid-request-transition.error';
import { NotRequestPassengerError } from '../src/modules/requests/errors/not-request-passenger.error';
import { NotTripPassengerError } from '../src/modules/requests/errors/not-trip-passenger.error';
import { RequestAlreadyExistsError } from '../src/modules/requests/errors/request-already-exists.error';
import { RequestNotFoundError } from '../src/modules/requests/errors/request-not-found.error';
import { RequestsService } from '../src/modules/requests/requests.service';
import { NotTripDriverError } from '../src/modules/trips/errors/not-trip-driver.error';
import { TripAlreadyStartedError } from '../src/modules/trips/errors/trip-already-started.error';
import { TripFullError } from '../src/modules/trips/errors/trip-full.error';
import { TripNotInProgressError } from '../src/modules/trips/errors/trip-not-in-progress.error';
import { TripNotOpenError } from '../src/modules/trips/errors/trip-not-open.error';
import { TripsService } from '../src/modules/trips/trips.service';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { ProfileRequiredError } from '../src/shared/auth/profile-required.error';

// RequestsService contra la base de datos real (requiere npm run migrate). Los
// usuarios llevan el prefijo EMAIL_PREFIX; en afterEach se borran sus eventos,
// viajes (las solicitudes caen en cascada) y usuarios, en ese orden
const EMAIL_PREFIX = 'requests-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};
const ALL = { offset: 0, limit: 100 };

describe('RequestsService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let requestsService: RequestsService;
  let tripsService: TripsService;
  let usersService: UsersService;
  let plateNumber = 9700;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    requestsService = app.get(RequestsService);
    tripsService = app.get(TripsService);
    usersService = app.get(UsersService);
  });

  afterEach(async () => {
    const testUsers = `SELECT id FROM users WHERE email LIKE '${EMAIL_PREFIX}%'`;
    const testTrips = `SELECT id FROM trips WHERE driver_id IN (${testUsers})`;
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN (${testTrips})
         OR source_entity_id IN
           (SELECT id FROM requests WHERE trip_id IN (${testTrips}))`,
    );
    await dataSource.query(`DELETE FROM trips WHERE id IN (${testTrips})`);
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${EMAIL_PREFIX}%`,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(
    name: string,
    profiles: ('driver' | 'passenger')[],
  ): Promise<string> {
    const user = await usersService.createWithProfiles({
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles,
    });
    return user.id;
  }

  // Conductor listo con un viaje publicado de offeredSeats plazas
  async function publishedTrip(
    offeredSeats = 2,
    driverName = 'dan',
    minutesToDeparture = 24 * 60,
  ): Promise<{ driverId: string; tripId: string; plate: string }> {
    const driverId = await createUser(driverName, ['driver', 'passenger']);
    await usersService.declareDriverLicense(driverId);
    plateNumber += 1;
    const plate = `${plateNumber}BCD`;
    const vehicle = await app
      .get(VehiclesService)
      .register(driverId, { plate, capacity: 4 });
    const { trip } = await tripsService.publish(driverId, {
      vehicleId: vehicle.id,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: new Date(Date.now() + minutesToDeparture * 60 * 1000),
      offeredSeats,
    });
    return { driverId, tripId: trip.id, plate };
  }

  async function seatsOf(tripId: string) {
    const { trip } = await tripsService.getById(tripId);
    return { available: trip.availableSeats, status: trip.status };
  }

  function eventTypesOf(sourceEntityId: string): Promise<string[]> {
    return dataSource.manager
      .find(DomainEvent, {
        where: { sourceEntityId },
        order: { occurredAt: 'ASC' },
      })
      .then((events) => events.map(({ type }) => type));
  }

  describe('request (RF-08)', () => {
    it('creates a pending request with the passenger name and no plate', async () => {
      const { tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);

      const view = await requestsService.request(pia, tripId);

      expect(view).toMatchObject({
        request: { tripId, passengerId: pia, status: 'pending' },
        passengerName: 'pia',
        vehiclePlate: null,
      });
      expect(await eventTypesOf(view.request.id)).toEqual(['request.created']);
    });

    it('copies the priority of the passenger (RF-24)', async () => {
      const { tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      await dataSource.query(
        'UPDATE passenger_profiles SET has_high_priority = true WHERE user_id = $1',
        [pia],
      );

      const { request } = await requestsService.request(pia, tripId);

      expect(request.isPriority).toBe(true);
    });

    it('rejects a second live request for the same trip', async () => {
      const { tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      await requestsService.request(pia, tripId);

      await expect(requestsService.request(pia, tripId)).rejects.toBeInstanceOf(
        RequestAlreadyExistsError,
      );
    });

    it("rejects a request for the passenger's own trip", async () => {
      const { driverId, tripId } = await publishedTrip();

      await expect(
        requestsService.request(driverId, tripId),
      ).rejects.toBeInstanceOf(CannotRequestOwnTripError);
    });

    it('requires the passenger profile', async () => {
      const { tripId } = await publishedTrip();
      const onlyDriver = await createUser('otto', ['driver']);

      await expect(
        requestsService.request(onlyDriver, tripId),
      ).rejects.toBeInstanceOf(ProfileRequiredError);
    });

    it('rejects full and closed trips', async () => {
      const { driverId, tripId } = await publishedTrip(1);
      const pia = await createUser('pia', ['passenger']);
      const leo = await createUser('leo', ['passenger']);
      const first = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, first.request.id);

      await expect(requestsService.request(leo, tripId)).rejects.toBeInstanceOf(
        TripFullError,
      );
      await tripsService.cancel(driverId, tripId);
      await expect(requestsService.request(leo, tripId)).rejects.toBeInstanceOf(
        TripNotOpenError,
      );
    });
  });

  describe('accept and reject (RF-09, RF-10)', () => {
    it('accepting takes a seat, confirms the trip and shows the plate', async () => {
      const { driverId, tripId, plate } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);

      const view = await requestsService.accept(driverId, request.id);

      expect(view.request.status).toBe('accepted');
      expect(view.vehiclePlate).toBe(plate);
      expect(await seatsOf(tripId)).toEqual({
        available: 1,
        status: 'confirmed',
      });
      expect(await eventTypesOf(request.id)).toEqual([
        'request.created',
        'request.accepted',
      ]);
    });

    it('never sells the last seat twice (simultaneous acceptances)', async () => {
      const { driverId, tripId } = await publishedTrip(1);
      const pia = await createUser('pia', ['passenger']);
      const leo = await createUser('leo', ['passenger']);
      const first = await requestsService.request(pia, tripId);
      const second = await requestsService.request(leo, tripId);

      const results = await Promise.allSettled([
        requestsService.accept(driverId, first.request.id),
        requestsService.accept(driverId, second.request.id),
      ]);

      const rejected = results.filter(({ status }) => status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(
        TripFullError,
      );
      expect(await seatsOf(tripId)).toEqual({
        available: 0,
        status: 'confirmed',
      });
    });

    it('rejecting keeps the seats and records request.rejected', async () => {
      const { driverId, tripId } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);

      const view = await requestsService.reject(driverId, request.id);

      expect(view.request.status).toBe('rejected');
      expect(await seatsOf(tripId)).toEqual({
        available: 2,
        status: 'published',
      });
    });

    it('only lets the driver of the trip decide', async () => {
      const { tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);

      await expect(
        requestsService.accept(pia, request.id),
      ).rejects.toBeInstanceOf(NotTripDriverError);
    });

    it('does not accept a request twice (state machine)', async () => {
      const { driverId, tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, request.id);

      await expect(
        requestsService.accept(driverId, request.id),
      ).rejects.toBeInstanceOf(InvalidRequestTransitionError);
    });
  });

  describe('cancel (passenger) and trip cancellation', () => {
    it('cancelling the only accepted request frees the seat and reopens the trip', async () => {
      const { driverId, tripId } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, request.id);

      const view = await requestsService.cancel(pia, request.id);

      expect(view.request.status).toBe('cancelled');
      expect(await seatsOf(tripId)).toEqual({
        available: 2,
        status: 'published',
      });
    });

    it('only the passenger cancels; others cannot even see it', async () => {
      const { driverId, tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      const stranger = await createUser('sam', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);

      await expect(
        requestsService.cancel(driverId, request.id),
      ).rejects.toBeInstanceOf(NotRequestPassengerError);
      await expect(
        requestsService.cancel(stranger, request.id),
      ).rejects.toBeInstanceOf(RequestNotFoundError);
      await expect(
        requestsService.get(stranger, request.id),
      ).rejects.toBeInstanceOf(RequestNotFoundError);
    });

    it('requires an incident once the trip has started (RF-23)', async () => {
      const { tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);
      await dataSource.query(
        "UPDATE trips SET status = 'in_progress' WHERE id = $1",
        [tripId],
      );

      await expect(
        requestsService.cancel(pia, request.id),
      ).rejects.toBeInstanceOf(TripAlreadyStartedError);
    });

    it('starting the trip rejects the pending requests and keeps the accepted ones (observer)', async () => {
      const { driverId, tripId } = await publishedTrip(2, 'dan', 10);
      const pia = await createUser('pia', ['passenger']);
      const leo = await createUser('leo', ['passenger']);
      const accepted = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, accepted.request.id);
      const pending = await requestsService.request(leo, tripId);

      await tripsService.start(driverId, tripId);

      const stillAccepted = await requestsService.get(pia, accepted.request.id);
      const rejected = await requestsService.get(leo, pending.request.id);
      expect(stillAccepted.request.status).toBe('accepted');
      expect(rejected.request.status).toBe('rejected');
      expect(await eventTypesOf(pending.request.id)).toEqual([
        'request.created',
        'request.rejected',
      ]);
    });

    it('cancelling the trip cancels all its live requests (observer)', async () => {
      const { driverId, tripId } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);
      const leo = await createUser('leo', ['passenger']);
      const accepted = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, accepted.request.id);
      const pending = await requestsService.request(leo, tripId);

      await tripsService.cancel(driverId, tripId);

      const page = await requestsService.listForTrip(driverId, tripId, ALL);
      expect(page.items.map(({ request }) => request.status)).toEqual([
        'cancelled',
        'cancelled',
      ]);
      expect(await eventTypesOf(pending.request.id)).toEqual([
        'request.created',
        'request.cancelled',
      ]);
    });
  });

  describe('get', () => {
    it('lets the passenger and the driver see the request', async () => {
      const { driverId, tripId } = await publishedTrip();
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);

      await expect(requestsService.get(pia, request.id)).resolves.toMatchObject(
        { passengerName: 'pia' },
      );
      await expect(
        requestsService.get(driverId, request.id),
      ).resolves.toMatchObject({ request: { id: request.id } });
    });

    it('answers REQUEST_NOT_FOUND for an unknown request', async () => {
      const pia = await createUser('pia', ['passenger']);
      const unknownId = '00000000-0000-4000-8000-000000000000';

      await expect(requestsService.get(pia, unknownId)).rejects.toBeInstanceOf(
        RequestNotFoundError,
      );
      await expect(
        requestsService.accept(pia, unknownId),
      ).rejects.toBeInstanceOf(RequestNotFoundError);
    });
  });

  // RF-23/RF-24: cancelaciones durante el viaje y prioridad
  describe('during the trip (incidents) and priority', () => {
    async function hasPriority(passengerId: string): Promise<boolean> {
      return usersService.getPassengerPriority(passengerId);
    }

    // Viaje en curso con un pasajero aceptado (pia) y otro pendiente que el
    // inicio rechaza (leo)
    async function tripInProgress() {
      const { driverId, tripId } = await publishedTrip(2, 'dan', 10);
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, request.id);
      await tripsService.start(driverId, tripId);
      return { driverId, tripId, pia, requestId: request.id };
    }

    it('gives priority to the accepted passengers when the driver cancels during the trip', async () => {
      const { driverId, tripId, pia, requestId } = await tripInProgress();

      await dataSource.transaction((manager) =>
        tripsService.cancelInProgress(manager, driverId, tripId),
      );

      expect(await hasPriority(pia)).toBe(true);
      const { request } = await requestsService.get(pia, requestId);
      expect(request.status).toBe('cancelled');
    });

    it('gives no priority when the trip is cancelled before it starts', async () => {
      const { driverId, tripId } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);
      const { request } = await requestsService.request(pia, tripId);
      await requestsService.accept(driverId, request.id);

      await tripsService.cancel(driverId, tripId);

      expect(await hasPriority(pia)).toBe(false);
    });

    it('lets a passenger leave a trip in progress: frees the seat, the trip goes on', async () => {
      const { tripId, pia } = await tripInProgress();

      const cancelled = await dataSource.transaction((manager) =>
        requestsService.leaveInProgressTrip(manager, pia, tripId),
      );

      expect(cancelled.status).toBe('cancelled');
      expect(await seatsOf(tripId)).toEqual({
        available: 2,
        status: 'in_progress',
      });
      expect(await hasPriority(pia)).toBe(false);
    });

    it('only lets accepted passengers leave a trip in progress', async () => {
      const { tripId } = await tripInProgress();
      const stranger = await createUser('sam', ['passenger']);

      await expect(
        dataSource.transaction((manager) =>
          requestsService.leaveInProgressTrip(manager, stranger, tripId),
        ),
      ).rejects.toBeInstanceOf(NotTripPassengerError);
    });

    it('only lets passengers leave a trip that is in progress', async () => {
      const { tripId } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);

      await expect(
        dataSource.transaction((manager) =>
          requestsService.leaveInProgressTrip(manager, pia, tripId),
        ),
      ).rejects.toBeInstanceOf(TripNotInProgressError);
    });

    it('removes the priority once a priority request is accepted', async () => {
      const { driverId, tripId } = await publishedTrip(2);
      const pia = await createUser('pia', ['passenger']);
      await dataSource.transaction((manager) =>
        usersService.grantPassengerPriority(manager, [pia]),
      );
      const { request } = await requestsService.request(pia, tripId);
      expect(request.isPriority).toBe(true);

      await requestsService.accept(driverId, request.id);

      expect(await hasPriority(pia)).toBe(false);
    });
  });

  describe('lists', () => {
    it('lists the requests of a trip with the priority ones first (RF-24)', async () => {
      const { driverId, tripId } = await publishedTrip(3);
      const pia = await createUser('pia', ['passenger']);
      const leo = await createUser('leo', ['passenger']);
      await dataSource.query(
        'UPDATE passenger_profiles SET has_high_priority = true WHERE user_id = $1',
        [leo],
      );
      await requestsService.request(pia, tripId);
      await requestsService.request(leo, tripId);

      const page = await requestsService.listForTrip(driverId, tripId, ALL);

      expect(page.total).toBe(2);
      expect(page.items.map(({ passengerName }) => passengerName)).toEqual([
        'leo',
        'pia',
      ]);
    });

    it("does not show a trip's requests to another driver", async () => {
      const { tripId } = await publishedTrip();
      const other = await createUser('oli', ['driver']);

      await expect(
        requestsService.listForTrip(other, tripId, ALL),
      ).rejects.toBeInstanceOf(NotTripDriverError);
    });

    it('lists my requests as a passenger', async () => {
      const first = await publishedTrip(2, 'dan');
      const second = await publishedTrip(2, 'eve');
      const pia = await createUser('pia', ['passenger']);
      await requestsService.request(pia, first.tripId);
      await requestsService.request(pia, second.tripId);

      const page = await requestsService.listForPassenger(pia, ALL);

      expect(page.total).toBe(2);
      expect(
        page.items.every(({ request }) => request.passengerId === pia),
      ).toBe(true);
    });
  });
});
