import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource, EntityManager } from 'typeorm';
import { AppModule } from '../src/app.module';
import { DomainEvent } from '../src/events/entities/domain-event.entity';
import { VehicleNotFoundError } from '../src/modules/users/errors/vehicle-not-found.error';
import { UsersService } from '../src/modules/users/users.service';
import { VehiclesService } from '../src/modules/users/vehicles.service';
import { DepartureInThePastError } from '../src/modules/trips/errors/departure-in-the-past.error';
import { DriverNotReadyError } from '../src/modules/trips/errors/driver-not-ready.error';
import { InvalidTripTransitionError } from '../src/modules/trips/errors/invalid-trip-transition.error';
import { NotTripDriverError } from '../src/modules/trips/errors/not-trip-driver.error';
import { SeatsExceedCapacityError } from '../src/modules/trips/errors/seats-exceed-capacity.error';
import { TripAlreadyStartedError } from '../src/modules/trips/errors/trip-already-started.error';
import { TripNotEditableError } from '../src/modules/trips/errors/trip-not-editable.error';
import { TripFullError } from '../src/modules/trips/errors/trip-full.error';
import { TripNotFoundError } from '../src/modules/trips/errors/trip-not-found.error';
import { TripNotOpenError } from '../src/modules/trips/errors/trip-not-open.error';
import { Trip } from '../src/modules/trips/entities/trip.entity';
import { TripInput, TripsService } from '../src/modules/trips/trips.service';

// TripsService contra la base de datos real (requiere npm run migrate). Los
// usuarios llevan el prefijo EMAIL_PREFIX. Los viajes y sus eventos no se
// borran en cascada con el usuario, así que se borran antes en afterEach
const EMAIL_PREFIX = 'trips-test-';
const UAL_CAMPUS = { type: 'Point' as const, coordinates: [-2.4058, 36.8297] };
const ALMERIA_CENTRE = {
  type: 'Point' as const,
  coordinates: [-2.4637, 36.8381],
};
const UNKNOWN_ID = '00000000-0000-4000-8000-000000000000';
const HOUR_MS = 60 * 60 * 1000;

describe('TripsService (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let tripsService: TripsService;
  let usersService: UsersService;
  let vehiclesService: VehiclesService;
  let plateNumber = 9400;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    tripsService = app.get(TripsService);
    usersService = app.get(UsersService);
    vehiclesService = app.get(VehiclesService);
  });

  afterEach(async () => {
    const testDrivers = `SELECT id FROM users WHERE email LIKE '${EMAIL_PREFIX}%'`;
    await dataSource.query(
      `DELETE FROM events WHERE source_entity_id IN
         (SELECT id FROM trips WHERE driver_id IN (${testDrivers}))`,
    );
    await dataSource.query(
      `DELETE FROM trips WHERE driver_id IN (${testDrivers})`,
    );
    await dataSource.query('DELETE FROM users WHERE email LIKE $1', [
      `${EMAIL_PREFIX}%`,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  // Conductor listo para publicar (RF-21): declaración y un vehículo de 4
  // plazas. Devuelve su id y el del vehículo
  async function readyDriver(
    name: string,
  ): Promise<{ driverId: string; vehicleId: string }> {
    const user = await usersService.createWithProfiles({
      name,
      email: `${EMAIL_PREFIX}${name}@ual.es`,
      passwordHash: 'hash',
      profiles: ['driver'],
    });
    await usersService.declareDriverLicense(user.id);
    plateNumber += 1;
    const vehicle = await vehiclesService.register(user.id, {
      plate: `${plateNumber}BCD`,
      capacity: 4,
    });
    return { driverId: user.id, vehicleId: vehicle.id };
  }

  function tripInput(vehicleId: string, overrides: Partial<TripInput> = {}) {
    return {
      vehicleId,
      origin: ALMERIA_CENTRE,
      destination: UAL_CAMPUS,
      departureAt: new Date(Date.now() + 24 * HOUR_MS),
      offeredSeats: 3,
      ...overrides,
    };
  }

  function eventsOf(tripId: string): Promise<DomainEvent[]> {
    return dataSource.manager.find(DomainEvent, {
      where: { sourceEntityId: tripId },
      order: { occurredAt: 'ASC' },
    });
  }

  describe('publish (RF-04)', () => {
    it('publishes the trip and records trip.published in the same transaction', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');

      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );

      expect(trip).toMatchObject({
        driverId,
        vehicleId,
        origin: ALMERIA_CENTRE,
        destination: UAL_CAMPUS,
        offeredSeats: 3,
        availableSeats: 3,
        maxDetourMin: 10,
        status: 'published',
      });
      const events = await eventsOf(trip.id);
      expect(events.map(({ type }) => type)).toEqual(['trip.published']);
      expect(events[0].payload).toMatchObject({
        driverId,
        offeredSeats: 3,
        destination: UAL_CAMPUS,
      });
    });

    it('requires the driver to be ready (RF-21) and says what is missing', async () => {
      const user = await usersService.createWithProfiles({
        name: 'bob',
        email: `${EMAIL_PREFIX}bob@ual.es`,
        passwordHash: 'hash',
        profiles: ['driver'],
      });

      const error = await tripsService
        .publish(user.id, tripInput(UNKNOWN_ID))
        .catch((e: unknown) => e);

      expect(error).toBeInstanceOf(DriverNotReadyError);
      expect((error as Error).message).toBe(
        'To publish trips the driver needs: the responsible declaration and an active vehicle',
      );
    });

    it("rejects another driver's vehicle", async () => {
      const ana = await readyDriver('ana');
      const bob = await readyDriver('bob');

      await expect(
        tripsService.publish(ana.driverId, tripInput(bob.vehicleId)),
      ).rejects.toBeInstanceOf(VehicleNotFoundError);
    });

    it('rejects more seats than the vehicle capacity', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');

      await expect(
        tripsService.publish(
          driverId,
          tripInput(vehicleId, { offeredSeats: 5 }),
        ),
      ).rejects.toBeInstanceOf(SeatsExceedCapacityError);
    });

    it('rejects a departure in the past', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');

      await expect(
        tripsService.publish(
          driverId,
          tripInput(vehicleId, { departureAt: new Date(Date.now() - HOUR_MS) }),
        ),
      ).rejects.toBeInstanceOf(DepartureInThePastError);
    });
  });

  describe('getById and listByDriver', () => {
    it('shows a trip with the name of its driver', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );

      const view = await tripsService.getById(trip.id);

      expect(view.driverName).toBe('ana');
      expect(view.trip.id).toBe(trip.id);
    });

    it('answers TRIP_NOT_FOUND for an unknown id', async () => {
      await expect(tripsService.getById(UNKNOWN_ID)).rejects.toBeInstanceOf(
        TripNotFoundError,
      );
    });

    it('lists the trips of the driver by departure time, with the total', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip: later } = await tripsService.publish(
        driverId,
        tripInput(vehicleId, {
          departureAt: new Date(Date.now() + 48 * HOUR_MS),
        }),
      );
      const { trip: sooner } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );

      const page = await tripsService.listByDriver(driverId, {
        offset: 0,
        limit: 10,
      });

      expect(page.total).toBe(2);
      expect(page.items.map(({ trip }) => trip.id)).toEqual([
        sooner.id,
        later.id,
      ]);
      expect(page.items[0].driverName).toBe('ana');
    });
  });

  describe('update (RF-05)', () => {
    it('changes a published trip and records trip.updated', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );

      const { trip: updated } = await tripsService.update(driverId, trip.id, {
        offeredSeats: 2,
        maxDetourMin: 5,
      });

      expect(updated).toMatchObject({
        offeredSeats: 2,
        availableSeats: 2,
        maxDetourMin: 5,
      });
      expect((await eventsOf(trip.id)).map(({ type }) => type)).toEqual([
        'trip.published',
        'trip.updated',
      ]);
    });

    it('applies the same rules as publishing', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );

      await expect(
        tripsService.update(driverId, trip.id, { offeredSeats: 9 }),
      ).rejects.toBeInstanceOf(SeatsExceedCapacityError);
      expect(await eventsOf(trip.id)).toHaveLength(1);
    });

    it('only lets the driver of the trip change it', async () => {
      const ana = await readyDriver('ana');
      const bob = await readyDriver('bob');
      const { trip } = await tripsService.publish(
        ana.driverId,
        tripInput(ana.vehicleId),
      );

      await expect(
        tripsService.update(bob.driverId, trip.id, { offeredSeats: 1 }),
      ).rejects.toBeInstanceOf(NotTripDriverError);
    });

    it('does not change a confirmed trip (only cancel it)', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );
      await dataSource.query(
        "UPDATE trips SET status = 'confirmed' WHERE id = $1",
        [trip.id],
      );

      await expect(
        tripsService.update(driverId, trip.id, { offeredSeats: 1 }),
      ).rejects.toBeInstanceOf(TripNotEditableError);
    });
  });

  describe('cancel (RF-05)', () => {
    it('cancels the trip and records trip.cancelled', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );

      const { trip: cancelled } = await tripsService.cancel(driverId, trip.id);

      expect(cancelled.status).toBe('cancelled');
      expect((await eventsOf(trip.id)).map(({ type }) => type)).toEqual([
        'trip.published',
        'trip.cancelled',
      ]);
    });

    it('requires an incident once the trip has started (RF-23)', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );
      await dataSource.query(
        "UPDATE trips SET status = 'in_progress' WHERE id = $1",
        [trip.id],
      );

      await expect(
        tripsService.cancel(driverId, trip.id),
      ).rejects.toBeInstanceOf(TripAlreadyStartedError);
    });

    it('answers TRIP_NOT_FOUND for an unknown trip', async () => {
      const { driverId } = await readyDriver('ana');

      await expect(
        tripsService.cancel(driverId, UNKNOWN_ID),
      ).rejects.toBeInstanceOf(TripNotFoundError);
    });

    it('rejects cancelling twice (state machine)', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );
      await tripsService.cancel(driverId, trip.id);

      await expect(
        tripsService.cancel(driverId, trip.id),
      ).rejects.toBeInstanceOf(InvalidTripTransitionError);
      expect(await eventsOf(trip.id)).toHaveLength(2);
    });
  });

  // Lo que trips ofrece a las solicitudes de plaza: todo dentro de una
  // transacción de quien llama
  describe('seat operations for seat requests (RF-10)', () => {
    // Suscriptor de prueba del patrón observador (se registra una vez: el
    // service es el mismo para todos los tests de este fichero)
    const cancelledListener = jest.fn();

    beforeAll(() => {
      tripsService.onTripCancelled(cancelledListener);
    });

    beforeEach(() => {
      cancelledListener.mockReset();
      cancelledListener.mockResolvedValue(undefined);
    });

    async function publishedTrip(offeredSeats = 2) {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId, { offeredSeats }),
      );
      return { driverId, trip };
    }

    function inTransaction<T>(
      work: (manager: EntityManager) => Promise<T>,
    ): Promise<T> {
      return dataSource.transaction(work);
    }

    it('reserving the first seat confirms the trip (trip.confirmed)', async () => {
      const { trip } = await publishedTrip(2);

      const reserved = await inTransaction(async (manager) =>
        tripsService.reserveSeat(
          manager,
          await tripsService.lockTrip(manager, trip.id),
        ),
      );

      expect(reserved).toMatchObject({
        availableSeats: 1,
        status: 'confirmed',
      });
      expect((await eventsOf(trip.id)).map(({ type }) => type)).toEqual([
        'trip.published',
        'trip.confirmed',
      ]);
    });

    it('rejects reserving a seat when there are none left (TRIP_FULL)', async () => {
      const { trip } = await publishedTrip(1);
      const reserve = () =>
        inTransaction(async (manager) =>
          tripsService.reserveSeat(
            manager,
            await tripsService.lockTrip(manager, trip.id),
          ),
        );
      await reserve();

      await expect(reserve()).rejects.toBeInstanceOf(TripFullError);
    });

    it('releasing the last taken seat reopens the trip (trip.reopened)', async () => {
      const { trip } = await publishedTrip(2);
      const lockAnd = (
        operation: 'reserveSeat' | 'releaseSeat',
      ): Promise<Trip> =>
        inTransaction(async (manager) =>
          tripsService[operation](
            manager,
            await tripsService.lockTrip(manager, trip.id),
          ),
        );
      await lockAnd('reserveSeat');

      const released = await lockAnd('releaseSeat');

      expect(released).toMatchObject({
        availableSeats: 2,
        status: 'published',
      });
      expect((await eventsOf(trip.id)).map(({ type }) => type)).toEqual([
        'trip.published',
        'trip.confirmed',
        'trip.reopened',
      ]);
    });

    it('only accepts requests for published or confirmed trips not yet departed', async () => {
      const { driverId, trip } = await publishedTrip();

      expect(() => tripsService.assertOpenForRequests(trip)).not.toThrow();
      const { trip: cancelled } = await tripsService.cancel(driverId, trip.id);
      expect(() => tripsService.assertOpenForRequests(cancelled)).toThrow(
        TripNotOpenError,
      );
      const departed = { ...trip, departureAt: new Date(Date.now() - HOUR_MS) };
      expect(() => tripsService.assertOpenForRequests(departed)).toThrow(
        TripNotOpenError,
      );
    });

    it('notifies the subscribers when a trip is cancelled (observer)', async () => {
      const { driverId, trip } = await publishedTrip();

      await tripsService.cancel(driverId, trip.id);

      expect(cancelledListener).toHaveBeenCalledTimes(1);
      expect(cancelledListener).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ id: trip.id, status: 'cancelled' }),
      );
    });

    it('undoes the whole cancellation if a subscriber fails', async () => {
      const { driverId, trip } = await publishedTrip();
      cancelledListener.mockRejectedValueOnce(new Error('subscriber failed'));

      await expect(tripsService.cancel(driverId, trip.id)).rejects.toThrow(
        'subscriber failed',
      );

      const { trip: unchanged } = await tripsService.getById(trip.id);
      expect(unchanged.status).toBe('published');
      expect(await eventsOf(trip.id)).toHaveLength(1);
    });
  });
});
