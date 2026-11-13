import { DataSource, EntityManager, Repository } from 'typeorm';
import { EventsService } from '../../events/events.service';
import { Trip } from '../trips/entities/trip.entity';
import type { TripLookupService } from '../trips/trip-lookup.service';
import { LateCancellationsService } from '../trips/late-cancellations.service';
import { TripRoutesService } from '../trips/trip-routes.service';
import { TripStatusService } from '../trips/trip-status.service';
import { TripsService } from '../trips/trips.service';
import { UsersService } from '../users/users.service';
import { SeatRequest } from './entities/seat-request.entity';
import { AlreadyBoardedError } from './errors/already-boarded.error';
import { InvalidBoardCodeError } from './errors/invalid-board-code.error';
import { PickupGracePeriodActiveError } from './errors/pickup-grace-period-active.error';
import { RequestChangesRecorder } from './request-changes';
import { RequestOverlapService } from './request-overlap.service';
import { RequestPickupsService } from './request-pickups.service';
import { RequestViewsService } from './request-views.service';
import { RequestsService } from './requests.service';

describe('RequestsService boarding and no-show', () => {
  let service: RequestsService;
  const lockTripSpy = jest.fn();
  const releaseSeatSpy = jest.fn().mockResolvedValue(undefined);
  const changesRecordSpy = jest.fn().mockResolvedValue(undefined);
  const recordPassengerCancellationSpy = jest.fn().mockResolvedValue(undefined);
  const eventsRecordSpy = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createService(manager: EntityManager): RequestsService {
    const dataSource = {
      transaction: async (
        cb: (m: EntityManager) => Promise<unknown>,
      ): Promise<unknown> => cb(manager),
    } as unknown as DataSource;

    const tripStatus = {
      lockTrip: lockTripSpy,
      releaseSeat: releaseSeatSpy,
    } as unknown as TripStatusService;

    const changes = {
      record: changesRecordSpy,
    } as unknown as RequestChangesRecorder;

    const lateCancellations = {
      recordPassengerCancellation: recordPassengerCancellationSpy,
    } as unknown as LateCancellationsService;

    const eventsService = {
      record: eventsRecordSpy,
    } as unknown as EventsService;

    const views = {
      toView: (req: SeatRequest) => Promise.resolve({ request: req }),
    } as unknown as RequestViewsService;

    const tripsService = {
      finishWithoutPassengers: jest.fn().mockResolvedValue(undefined),
    } as unknown as TripsService;

    return new RequestsService(
      dataSource,
      {} as unknown as Repository<SeatRequest>,
      tripsService,
      {} as TripRoutesService,
      tripStatus,
      {} as UsersService,
      views,
      changes,
      lateCancellations,
      {} as RequestOverlapService,
      eventsService,
      {} as TripLookupService,
      {} as RequestPickupsService,
    );
  }

  it('validates boarding when code matches and records event', async () => {
    const trip = { id: 'trip-1', driverId: 'driver-1' } as Trip;
    const request = {
      id: 'req-1',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
      seats: 1,
      requestedAt: new Date('2026-11-03T08:00:00Z'),
      boardCode: '5829',
      boardedAt: null,
    } as SeatRequest;

    const manager = {
      findOneBy: jest.fn().mockResolvedValue(request),
      findOneOrFail: jest.fn().mockResolvedValue(request),
      save: (req: unknown) => Promise.resolve(req),
    } as unknown as EntityManager;

    lockTripSpy.mockResolvedValue(trip);
    service = createService(manager);

    const result = await service.board('driver-1', 'req-1', '5829');

    expect(result.request.boardedAt).toBeInstanceOf(Date);
    expect(eventsRecordSpy).toHaveBeenCalledWith(
      manager,
      expect.objectContaining({
        type: 'request.boarded',
        sourceEntityId: 'req-1',
        // v2: con el estado completo de la solicitud
        payload: expect.objectContaining({
          requestId: 'req-1',
          tripId: 'trip-1',
          status: 'accepted',
          boardedAt: expect.any(String) as string,
        }) as Record<string, unknown>,
      }),
    );
  });

  it('throws InvalidBoardCodeError when code does not match', async () => {
    const trip = { id: 'trip-1', driverId: 'driver-1' } as Trip;
    const request = {
      id: 'req-1',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
      boardCode: '5829',
      boardedAt: null,
    } as SeatRequest;

    const manager = {
      findOneBy: jest.fn().mockResolvedValue(request),
      findOneOrFail: jest.fn().mockResolvedValue(request),
    } as unknown as EntityManager;

    lockTripSpy.mockResolvedValue(trip);
    service = createService(manager);

    await expect(service.board('driver-1', 'req-1', '0000')).rejects.toThrow(
      InvalidBoardCodeError,
    );
  });

  it('throws AlreadyBoardedError when already boarded', async () => {
    const trip = { id: 'trip-1', driverId: 'driver-1' } as Trip;
    const request = {
      id: 'req-1',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
      boardCode: '5829',
      boardedAt: new Date(),
    } as SeatRequest;

    const manager = {
      findOneBy: jest.fn().mockResolvedValue(request),
      findOneOrFail: jest.fn().mockResolvedValue(request),
    } as unknown as EntityManager;

    lockTripSpy.mockResolvedValue(trip);
    service = createService(manager);

    await expect(service.board('driver-1', 'req-1', '5829')).rejects.toThrow(
      AlreadyBoardedError,
    );
  });

  it('throws PickupGracePeriodActiveError when marking no-show before 5 minutes have elapsed', async () => {
    const trip = {
      id: 'trip-1',
      driverId: 'driver-1',
      departureAt: new Date('2026-11-03T10:00:00Z'),
    } as Trip;
    const request = {
      id: 'req-1',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
      pickupAt: new Date('2026-11-03T10:05:00Z'),
      seats: 1,
    } as SeatRequest;

    const manager = {
      findOneBy: jest.fn().mockResolvedValue(request),
      findOneOrFail: jest.fn().mockResolvedValue(request),
    } as unknown as EntityManager;

    lockTripSpy.mockResolvedValue(trip);
    service = createService(manager);

    // Only 2 minutes after pickup (10:07:00Z < 10:10:00Z)
    const now = new Date('2026-11-03T10:07:00Z');
    await expect(service.noShow('driver-1', 'req-1', now)).rejects.toThrow(
      PickupGracePeriodActiveError,
    );
  });

  it('marks no-show, cancels seat request, releases seat, and records passenger late cancellation after 5 minutes', async () => {
    const trip = {
      id: 'trip-1',
      driverId: 'driver-1',
      departureAt: new Date('2026-11-03T10:00:00Z'),
      status: 'in_progress',
    } as Trip;
    const request = {
      id: 'req-1',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
      pickupAt: new Date('2026-11-03T10:05:00Z'),
      seats: 1,
      rejectionReason: null,
      cancelledAt: null,
    } as SeatRequest;

    const manager = {
      findOneBy: jest.fn().mockResolvedValue(request),
      findOneOrFail: jest.fn().mockResolvedValue(request),
      save: (req: unknown) => Promise.resolve(req),
      count: jest.fn().mockResolvedValue(0),
    } as unknown as EntityManager;

    lockTripSpy.mockResolvedValue(trip);
    service = createService(manager);

    // 6 minutes after pickup: 10:11:00Z > 10:10:00Z
    const now = new Date('2026-11-03T10:11:00Z');
    const result = await service.noShow('driver-1', 'req-1', now);

    expect(result.request.status).toBe('cancelled');
    expect(result.request.rejectionReason).toBe('no_show');
    expect(releaseSeatSpy).toHaveBeenCalledWith(manager, trip, 1);
    expect(recordPassengerCancellationSpy).toHaveBeenCalledWith(
      manager,
      trip,
      'p-1',
    );
    expect(changesRecordSpy).toHaveBeenCalledWith(
      manager,
      'request.cancelled',
      expect.objectContaining({ rejectionReason: 'no_show' }),
      trip,
    );
  });
});
