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
import { TripNotInProgressError } from '../src/modules/trips/errors/trip-not-in-progress.error';
import { TripNotStartableYetError } from '../src/modules/trips/errors/trip-not-startable-yet.error';
import { VehicleInUseError } from '../src/modules/users/errors/vehicle-in-use.error';
import { TripNotFoundError } from '../src/modules/trips/errors/trip-not-found.error';
import { TripNotOpenError } from '../src/modules/trips/errors/trip-not-open.error';
import { Trip } from '../src/modules/trips/entities/trip.entity';
import { TripStatusService } from '../src/modules/trips/trip-status.service';
import { TripInput, TripsService } from '../src/modules/trips/trips.service';
import { deleteTestUsers } from './support/cleanup';
import { setDepartureIn } from './support/trips';

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
  let tripStatus: TripStatusService;
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
    tripStatus = app.get(TripStatusService);
    usersService = app.get(UsersService);
    vehiclesService = app.get(VehiclesService);
  });

  afterEach(async () => {
    await deleteTestUsers(dataSource, EMAIL_PREFIX);
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
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
      engine: 'hybrid',
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
        "UPDATE trips SET status = 'in_progress', started_at = now() WHERE id = $1",
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
    const statusListener = jest.fn();

    beforeAll(() => {
      tripStatus.onTripStatusChanged(statusListener);
    });

    beforeEach(() => {
      statusListener.mockReset();
      statusListener.mockResolvedValue(undefined);
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
        tripStatus.reserveSeat(
          manager,
          await tripStatus.lockTrip(manager, trip.id),
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

    it('notifies published → confirmed when the first seat is reserved', async () => {
      const { trip } = await publishedTrip(2);

      await inTransaction(async (manager) =>
        tripStatus.reserveSeat(
          manager,
          await tripStatus.lockTrip(manager, trip.id),
        ),
      );

      expect(statusListener).toHaveBeenCalledWith(expect.anything(), {
        trip: expect.objectContaining({ id: trip.id }) as unknown,
        from: 'published',
        to: 'confirmed',
      });
    });

    it('rejects reserving a seat when there are none left (TRIP_FULL)', async () => {
      const { trip } = await publishedTrip(1);
      const reserve = () =>
        inTransaction(async (manager) =>
          tripStatus.reserveSeat(
            manager,
            await tripStatus.lockTrip(manager, trip.id),
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
          tripStatus[operation](
            manager,
            await tripStatus.lockTrip(manager, trip.id),
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

      expect(() => tripStatus.assertOpenForRequests(trip)).not.toThrow();
      const { trip: cancelled } = await tripsService.cancel(driverId, trip.id);
      expect(() => tripStatus.assertOpenForRequests(cancelled)).toThrow(
        TripNotOpenError,
      );
      const departed = { ...trip, departureAt: new Date(Date.now() - HOUR_MS) };
      expect(() => tripStatus.assertOpenForRequests(departed)).toThrow(
        TripNotOpenError,
      );
    });

    it('notifies the subscribers when a trip is cancelled (observer)', async () => {
      const { driverId, trip } = await publishedTrip();

      await tripsService.cancel(driverId, trip.id);

      expect(statusListener).toHaveBeenCalledTimes(1);
      expect(statusListener).toHaveBeenCalledWith(expect.anything(), {
        trip: expect.objectContaining({ id: trip.id }) as unknown,
        from: 'published',
        to: 'cancelled',
      });
    });

    it('undoes the whole cancellation if a subscriber fails', async () => {
      const { driverId, trip } = await publishedTrip();
      statusListener.mockRejectedValueOnce(new Error('subscriber failed'));

      await expect(tripsService.cancel(driverId, trip.id)).rejects.toThrow(
        'subscriber failed',
      );

      const { trip: unchanged } = await tripsService.getById(trip.id);
      expect(unchanged.status).toBe('published');
      expect(await eventsOf(trip.id)).toHaveLength(1);
    });
  });

  describe('start and finish (RF-11)', () => {
    // Viaje confirmado (con pasajeros) que sale dentro de esos minutos. Se
    // confirma con SQL: las solicitudes se prueban en su propio módulo
    async function confirmedTrip(
      minutesToDeparture: number,
      driver?: { driverId: string; vehicleId: string },
    ) {
      const { driverId, vehicleId } = driver ?? (await readyDriver('ana'));
      // Publicado con la antelación mínima y movido a la salida pedida
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );
      await setDepartureIn(dataSource, trip.id, minutesToDeparture);
      await dataSource.query(
        "UPDATE trips SET status = 'confirmed' WHERE id = $1",
        [trip.id],
      );
      return { driverId, vehicleId, tripId: trip.id };
    }

    async function vehicleStatus(vehicleId: string): Promise<string> {
      const [row] = await dataSource.query<{ status: string }[]>(
        'SELECT status FROM vehicles WHERE id = $1',
        [vehicleId],
      );
      return row.status;
    }

    it('starts a confirmed trip: in progress, vehicle on trip, trip.started', async () => {
      const { driverId, vehicleId, tripId } = await confirmedTrip(10);

      const { trip } = await tripsService.start(driverId, tripId);

      expect(trip.status).toBe('in_progress');
      expect(await vehicleStatus(vehicleId)).toBe('on_trip');
      expect((await eventsOf(tripId)).map(({ type }) => type)).toContain(
        'trip.started',
      );
    });

    it('can be started up to 30 minutes before the departure, not earlier', async () => {
      const { driverId, tripId } = await confirmedTrip(60);

      await expect(tripsService.start(driverId, tripId)).rejects.toBeInstanceOf(
        TripNotStartableYetError,
      );
    });

    it('only starts confirmed trips (state machine)', async () => {
      const { driverId, vehicleId } = await readyDriver('ana');
      const { trip } = await tripsService.publish(
        driverId,
        tripInput(vehicleId),
      );
      await setDepartureIn(dataSource, trip.id, 10);

      await expect(
        tripsService.start(driverId, trip.id),
      ).rejects.toBeInstanceOf(InvalidTripTransitionError);
      expect(await vehicleStatus(vehicleId)).toBe('available');
    });

    it('does not start two trips with the same vehicle at once', async () => {
      const driver = await readyDriver('ana');
      const first = await confirmedTrip(10, driver);
      const second = await confirmedTrip(20, driver);
      await tripsService.start(driver.driverId, first.tripId);

      await expect(
        tripsService.start(driver.driverId, second.tripId),
      ).rejects.toBeInstanceOf(VehicleInUseError);
    });

    it('does not start a trip whose vehicle was deactivated meanwhile', async () => {
      const { driverId, vehicleId, tripId } = await confirmedTrip(10);
      await vehiclesService.deactivate(driverId, vehicleId);

      await expect(tripsService.start(driverId, tripId)).rejects.toBeInstanceOf(
        VehicleNotFoundError,
      );
    });

    it('finishes a trip in progress: the vehicle is available again', async () => {
      const { driverId, vehicleId, tripId } = await confirmedTrip(10);
      await tripsService.start(driverId, tripId);

      const { trip } = await tripsService.finish(driverId, tripId);

      expect(trip.status).toBe('finished');
      expect(await vehicleStatus(vehicleId)).toBe('available');
      expect((await eventsOf(tripId)).map(({ type }) => type)).toContain(
        'trip.finished',
      );
    });

    it('does not finish a trip that has not started (state machine)', async () => {
      const { driverId, tripId } = await confirmedTrip(10);

      await expect(
        tripsService.finish(driverId, tripId),
      ).rejects.toBeInstanceOf(InvalidTripTransitionError);
    });

    // RF-23: cancelar DURANTE el viaje (lo usa el módulo de incidencias, en su
    // propia transacción)
    it('cancels a trip in progress: the vehicle is available again', async () => {
      const { driverId, vehicleId, tripId } = await confirmedTrip(10);
      await tripsService.start(driverId, tripId);

      const cancelled = await dataSource.transaction((manager) =>
        tripsService.cancelInProgress(manager, driverId, tripId),
      );

      expect(cancelled.status).toBe('cancelled');
      expect(await vehicleStatus(vehicleId)).toBe('available');
    });

    it('only cancels with an incident a trip that is in progress', async () => {
      const { driverId, tripId } = await confirmedTrip(10);

      await expect(
        dataSource.transaction((manager) =>
          tripsService.cancelInProgress(manager, driverId, tripId),
        ),
      ).rejects.toBeInstanceOf(TripNotInProgressError);
    });
  });
});
