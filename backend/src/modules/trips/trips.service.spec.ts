import { DataSource, EntityManager, Repository } from 'typeorm';
import { Trip } from './entities/trip.entity';
import { LateCancellationsService } from './late-cancellations.service';
import { PublishingLimitsService } from './publishing-limits.service';
import { TripRoutesService } from './trip-routes.service';
import { TripStatusService } from './trip-status.service';
import { TripsService } from './trips.service';
import { UsersService } from '../users/users.service';
import { VehiclesService } from '../users/vehicles.service';

describe('TripsService cancelUnstartedTrips', () => {
  let service: TripsService;
  const changeStatusSpy = jest
    .fn()
    .mockImplementation((_m: unknown, trip: Trip, status: string) => {
      (trip as { status: string }).status = status;
      return Promise.resolve(trip);
    });
  const recordDriverCancellationSpy = jest.fn().mockResolvedValue(undefined);
  const findSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const tripsRepository = {
      find: findSpy,
    } as unknown as Repository<Trip>;

    const tripStatus = {
      changeStatus: changeStatusSpy,
    } as unknown as TripStatusService;

    const lateCancellations = {
      recordDriverCancellation: recordDriverCancellationSpy,
    } as unknown as LateCancellationsService;

    const manager = {
      findOne: jest.fn(),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: async (
        cb: (m: EntityManager) => Promise<unknown>,
      ): Promise<unknown> => cb(manager),
    } as unknown as DataSource;

    service = new TripsService(
      dataSource,
      tripsRepository,
      {} as UsersService,
      {} as VehiclesService,
      tripStatus,
      {} as TripRoutesService,
      lateCancellations,
      {} as PublishingLimitsService,
    );
  });

  it('cancels confirmed trip and records driver late cancellation when > 15 min past departure', async () => {
    const unstartedConfirmedTrip = {
      id: 'trip-confirmed-1',
      status: 'confirmed',
      departureAt: new Date('2026-11-03T09:00:00Z'),
      driverId: 'driver-1',
    } as Trip;

    findSpy.mockResolvedValue([
      { id: 'trip-confirmed-1', driverId: 'driver-1' },
    ]);

    const manager = {
      findOne: jest.fn().mockResolvedValue(unstartedConfirmedTrip),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: async (
        cb: (m: EntityManager) => Promise<unknown>,
      ): Promise<unknown> => cb(manager),
    } as unknown as DataSource;

    const tripStatus = {
      changeStatus: changeStatusSpy,
    } as unknown as TripStatusService;

    const lateCancellations = {
      recordDriverCancellation: recordDriverCancellationSpy,
    } as unknown as LateCancellationsService;

    service = new TripsService(
      dataSource,
      { find: findSpy } as unknown as Repository<Trip>,
      {} as UsersService,
      {} as VehiclesService,
      tripStatus,
      {} as TripRoutesService,
      lateCancellations,
      {} as PublishingLimitsService,
    );

    // Current time: 09:16:00Z (16 min after departure -> > 15 min)
    const now = new Date('2026-11-03T09:16:00Z');
    const cancelledCount = await service.cancelUnstartedTrips(now);

    expect(cancelledCount).toBe(1);
    expect(changeStatusSpy).toHaveBeenCalledWith(
      manager,
      unstartedConfirmedTrip,
      'cancelled',
    );
    expect(recordDriverCancellationSpy).toHaveBeenCalledWith(
      manager,
      unstartedConfirmedTrip,
    );
  });

  it('cancels published unstarted trip without late cancellation penalty', async () => {
    const unstartedPublishedTrip = {
      id: 'trip-published-1',
      status: 'published',
      departureAt: new Date('2026-11-03T09:00:00Z'),
      driverId: 'driver-1',
    } as Trip;

    findSpy.mockResolvedValue([
      { id: 'trip-published-1', driverId: 'driver-1' },
    ]);

    const manager = {
      findOne: jest.fn().mockResolvedValue(unstartedPublishedTrip),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: async (
        cb: (m: EntityManager) => Promise<unknown>,
      ): Promise<unknown> => cb(manager),
    } as unknown as DataSource;

    const tripStatus = {
      changeStatus: changeStatusSpy,
    } as unknown as TripStatusService;

    const lateCancellations = {
      recordDriverCancellation: recordDriverCancellationSpy,
    } as unknown as LateCancellationsService;

    service = new TripsService(
      dataSource,
      { find: findSpy } as unknown as Repository<Trip>,
      {} as UsersService,
      {} as VehiclesService,
      tripStatus,
      {} as TripRoutesService,
      lateCancellations,
      {} as PublishingLimitsService,
    );

    const now = new Date('2026-11-03T09:20:00Z');
    const cancelledCount = await service.cancelUnstartedTrips(now);

    expect(cancelledCount).toBe(1);
    expect(changeStatusSpy).toHaveBeenCalledWith(
      manager,
      unstartedPublishedTrip,
      'cancelled',
    );
    expect(recordDriverCancellationSpy).not.toHaveBeenCalled();
  });

  it('delegates planRoute to TripRoutesService.plan', async () => {
    const planSpy = jest.fn().mockResolvedValue({ distanceKm: 10 });
    const tripRoutes = { plan: planSpy } as unknown as TripRoutesService;
    const tripsService = new TripsService(
      {} as DataSource,
      {} as Repository<Trip>,
      {} as UsersService,
      {} as VehiclesService,
      {} as TripStatusService,
      tripRoutes,
      {} as LateCancellationsService,
      {} as PublishingLimitsService,
    );
    const origin = { type: 'Point', coordinates: [-2.5, 36.8] } as const;
    const destination = { type: 'Point', coordinates: [-2.4, 36.83] } as const;
    const result = await tripsService.planRoute(
      origin as any,
      destination as any,
    );
    expect(planSpy).toHaveBeenCalledWith(origin, destination);
    expect(result).toEqual({ distanceKm: 10 });
  });
});
