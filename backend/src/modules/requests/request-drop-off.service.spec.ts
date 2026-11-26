import type { DataSource, EntityManager } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import { NotTripDriverError } from '../trips/errors/not-trip-driver.error';
import { TripNotInProgressError } from '../trips/errors/trip-not-in-progress.error';
import type { TripStatusService } from '../trips/trip-status.service';
import type { TripsService } from '../trips/trips.service';
import { SeatRequest } from './entities/seat-request.entity';
import { InvalidRequestTransitionError } from './errors/invalid-request-transition.error';
import { NotRequestPassengerError } from './errors/not-request-passenger.error';
import { PassengerNotBoardedError } from './errors/passenger-not-boarded.error';
import { RequestNotFoundError } from './errors/request-not-found.error';
import { RequestDropOffService } from './request-drop-off.service';
import type { RequestChangesRecorder } from './request-changes';
import type { RequestView, RequestViewsService } from './request-views.service';

// Cierre por pasajero: «Ha bajado» (conductor) y «He llegado» (pasajero)
describe('RequestDropOffService', () => {
  const trip = (overrides: Partial<Trip> = {}): Trip =>
    ({
      id: 'trip-1',
      driverId: 'driver-1',
      status: 'in_progress',
      ...overrides,
    }) as Trip;
  const seat = (overrides: Partial<SeatRequest> = {}): SeatRequest =>
    Object.assign(new SeatRequest(), {
      id: 'req-1',
      tripId: 'trip-1',
      passengerId: 'passenger-1',
      status: 'accepted',
      boardedAt: new Date('2026-11-17T08:00:00Z'),
      droppedOffAt: null,
      droppedOffBy: null,
      ...overrides,
    });

  let manager: {
    findOneBy: jest.Mock;
    findOneOrFail: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    save: jest.Mock;
  };
  let tripStatus: { lockTrip: jest.Mock };
  let tripsService: { finishWithoutPassengers: jest.Mock };
  let changes: { record: jest.Mock };
  let service: RequestDropOffService;

  function arrange(
    lockedTrip: Trip,
    request: SeatRequest,
    remaining = 1,
  ): void {
    manager.findOneBy.mockResolvedValue(request);
    manager.findOneOrFail.mockResolvedValue(request);
    tripStatus.lockTrip.mockResolvedValue(lockedTrip);
    manager.count.mockResolvedValue(remaining);
  }

  beforeEach(() => {
    manager = {
      findOneBy: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      save: jest.fn((value: unknown) => Promise.resolve(value)),
    };
    tripStatus = { lockTrip: jest.fn() };
    tripsService = { finishWithoutPassengers: jest.fn() };
    changes = { record: jest.fn() };
    const dataSource = {
      transaction: (work: (m: EntityManager) => Promise<unknown>) =>
        work(manager as unknown as EntityManager),
    };
    const views = {
      toView: jest.fn((request: SeatRequest) =>
        Promise.resolve({ request } as RequestView),
      ),
    };
    service = new RequestDropOffService(
      dataSource as unknown as DataSource,
      tripStatus as unknown as TripStatusService,
      tripsService as unknown as TripsService,
      changes as unknown as RequestChangesRecorder,
      views as unknown as RequestViewsService,
    );
  });

  it('closes the seat when the driver marks the drop-off, with its event', async () => {
    arrange(trip(), seat());

    const result = await service.dropOff('driver-1', 'req-1');

    expect(result.request).toMatchObject({
      status: 'completed',
      droppedOffBy: 'driver',
    });
    expect(result.request.droppedOffAt).toBeInstanceOf(Date);
    expect(changes.record).toHaveBeenCalledWith(
      manager,
      'request.completed',
      expect.objectContaining({ id: 'req-1' }),
      expect.objectContaining({ id: 'trip-1' }),
    );
    expect(tripsService.finishWithoutPassengers).not.toHaveBeenCalled();
  });

  it('finishes the trip when the last passenger arrives', async () => {
    arrange(trip(), seat(), 0);

    const result = await service.arrive('passenger-1', 'req-1');

    expect(result.request).toMatchObject({
      status: 'completed',
      droppedOffBy: 'passenger',
    });
    expect(tripsService.finishWithoutPassengers).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({ id: 'trip-1' }),
    );
  });

  it('returns the same seat if the other side already closed it (idempotent)', async () => {
    arrange(trip(), seat({ status: 'completed', droppedOffBy: 'passenger' }));

    const result = await service.dropOff('driver-1', 'req-1');

    expect(result.request).toMatchObject({
      status: 'completed',
      droppedOffBy: 'passenger',
    });
    expect(manager.save).not.toHaveBeenCalled();
    expect(changes.record).not.toHaveBeenCalled();
  });

  it('rejects a drop-off when the trip is not in progress', async () => {
    arrange(trip({ status: 'confirmed' }), seat());

    await expect(service.dropOff('driver-1', 'req-1')).rejects.toBeInstanceOf(
      TripNotInProgressError,
    );
  });

  it('rejects a seat that is not accepted', async () => {
    arrange(trip(), seat({ status: 'cancelled' }));

    await expect(service.arrive('passenger-1', 'req-1')).rejects.toBeInstanceOf(
      InvalidRequestTransitionError,
    );
  });

  it('rejects a passenger who has not boarded yet (PASSENGER_NOT_BOARDED)', async () => {
    arrange(trip(), seat({ boardedAt: null }));

    await expect(service.dropOff('driver-1', 'req-1')).rejects.toBeInstanceOf(
      PassengerNotBoardedError,
    );
  });

  it('rejects an unknown request', async () => {
    manager.findOneBy.mockResolvedValue(null);

    await expect(
      service.arrive('passenger-1', 'missing'),
    ).rejects.toBeInstanceOf(RequestNotFoundError);
  });

  it('only lets the driver of the trip mark the drop-off', async () => {
    arrange(trip(), seat());

    await expect(
      service.dropOff('passenger-1', 'req-1'),
    ).rejects.toBeInstanceOf(NotTripDriverError);
    await expect(service.dropOff('stranger', 'req-1')).rejects.toBeInstanceOf(
      RequestNotFoundError,
    );
  });

  it('only lets the passenger of the seat mark the arrival', async () => {
    arrange(trip(), seat());

    await expect(service.arrive('driver-1', 'req-1')).rejects.toBeInstanceOf(
      NotRequestPassengerError,
    );
    await expect(service.arrive('stranger', 'req-1')).rejects.toBeInstanceOf(
      RequestNotFoundError,
    );
  });

  it('closes every open seat when the trip finishes', async () => {
    manager.find.mockResolvedValue([
      seat({ id: 'req-1' }),
      seat({ id: 'req-2' }),
    ]);

    await service.closeOpenSeats(
      manager as unknown as EntityManager,
      trip(),
      'system',
    );

    expect(manager.save).toHaveBeenCalledTimes(2);
    expect(changes.record).toHaveBeenCalledTimes(2);
    expect(manager.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'req-2',
        status: 'completed',
        droppedOffBy: 'system',
      }),
    );
  });
});
