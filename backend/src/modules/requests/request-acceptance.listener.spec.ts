import { EntityManager } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import type { TripLookupService } from '../trips/trip-lookup.service';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestAcceptanceListener } from './request-acceptance.listener';
import { RequestChange, RequestChangesRecorder } from './request-changes';
import { RequestOverlapService } from './request-overlap.service';

describe('RequestAcceptanceListener', () => {
  let listener: RequestAcceptanceListener;
  let listenerCallback: (
    manager: EntityManager,
    change: RequestChange,
  ) => Promise<void>;

  const recordSpy = jest.fn().mockResolvedValue(undefined);
  const findSpy = jest.fn();
  const saveSpy = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const changes = {
      onRequestChanged: (
        cb: (manager: EntityManager, change: RequestChange) => Promise<void>,
      ) => {
        listenerCallback = cb;
      },
      record: recordSpy,
      recordOverlapCancellation: jest.fn().mockResolvedValue(undefined),
    } as unknown as RequestChangesRecorder;

    const overlaps = {
      scheduleForTrip: jest.fn().mockResolvedValue({
        departureAt: new Date(),
        durationMin: 30,
      }),
      overlappingPendingRequests: jest.fn().mockResolvedValue([]),
      lockPendingRequests: jest.fn().mockResolvedValue([]),
    } as unknown as RequestOverlapService;

    const tripLookup = {
      findByIds: jest.fn().mockResolvedValue(new Map()),
    } as unknown as TripLookupService;

    listener = new RequestAcceptanceListener(changes, overlaps, tripLookup);
    listener.onModuleInit();
  });

  it('rejects remaining pending requests with trip_full when trip reaches 0 available seats', async () => {
    const fullTrip = {
      id: 'trip-1',
      availableSeats: 0,
      driverId: 'driver-1',
    } as Trip;

    const acceptedRequest = {
      id: 'req-accepted',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
    } as SeatRequest;

    const pendingRequest1 = {
      id: 'req-pending-1',
      tripId: 'trip-1',
      passengerId: 'p-2',
      status: 'pending',
    } as SeatRequest;

    const pendingRequest2 = {
      id: 'req-pending-2',
      tripId: 'trip-1',
      passengerId: 'p-3',
      status: 'pending',
    } as SeatRequest;

    findSpy.mockResolvedValue([pendingRequest1, pendingRequest2]);
    saveSpy.mockImplementation((items: unknown) => Promise.resolve(items));

    const manager = {
      find: findSpy,
      save: saveSpy,
    } as unknown as EntityManager;

    await listenerCallback(manager, {
      type: 'request.accepted',
      request: acceptedRequest,
      trip: fullTrip,
    });

    expect(findSpy).toHaveBeenCalledWith(SeatRequest, {
      where: { tripId: 'trip-1', status: 'pending' },
      lock: { mode: 'pessimistic_write' },
    });

    expect(pendingRequest1.status).toBe('rejected');
    expect(pendingRequest1.rejectionReason).toBe('trip_full');
    expect(pendingRequest2.status).toBe('rejected');
    expect(pendingRequest2.rejectionReason).toBe('trip_full');

    expect(recordSpy).toHaveBeenCalledWith(
      manager,
      'request.rejected',
      pendingRequest1,
      fullTrip,
    );
    expect(recordSpy).toHaveBeenCalledWith(
      manager,
      'request.rejected',
      pendingRequest2,
      fullTrip,
    );
  });

  it('does not reject pending requests if availableSeats > 0', async () => {
    const tripWithSeats = {
      id: 'trip-1',
      availableSeats: 2,
    } as Trip;

    const acceptedRequest = {
      id: 'req-accepted',
      tripId: 'trip-1',
      passengerId: 'p-1',
      status: 'accepted',
    } as SeatRequest;

    findSpy.mockResolvedValue([]);

    const manager = {
      find: findSpy,
      save: saveSpy,
    } as unknown as EntityManager;

    await listenerCallback(manager, {
      type: 'request.accepted',
      request: acceptedRequest,
      trip: tripWithSeats,
    });

    expect(findSpy).not.toHaveBeenCalledWith(SeatRequest, expect.anything());
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
