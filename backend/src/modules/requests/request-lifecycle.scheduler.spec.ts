import { DataSource, EntityManager } from 'typeorm';
import { Trip } from '../trips/entities/trip.entity';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestLifecycleScheduler } from './request-lifecycle.scheduler';

describe('RequestLifecycleScheduler', () => {
  let scheduler: RequestLifecycleScheduler;
  const recordSpy = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expires pending requests when remaining time to departure is <= 30 minutes', async () => {
    const trip = {
      id: 'trip-1',
      departureAt: new Date('2026-11-03T09:20:00Z'),
    } as Trip;

    const pendingRequest = {
      id: 'req-1',
      tripId: 'trip-1',
      status: 'pending',
    } as SeatRequest;

    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([pendingRequest]),
    };

    const manager = {
      createQueryBuilder: () => queryBuilder,
      find: jest.fn().mockResolvedValue([trip]),
      save: (items: unknown) => Promise.resolve(items),
    } as unknown as EntityManager;

    const dataSource = {
      transaction: async (
        cb: (m: EntityManager) => Promise<unknown>,
      ): Promise<unknown> => cb(manager),
    } as unknown as DataSource;

    const changes = {
      record: recordSpy,
    } as unknown as RequestChangesRecorder;

    scheduler = new RequestLifecycleScheduler(dataSource, changes);

    // Current time: 09:00:00Z -> departure is in 20 min (<= 30 min)
    const now = new Date('2026-11-03T09:00:00Z');
    const expiredCount = await scheduler.expirePendingRequests(now);

    expect(expiredCount).toBe(1);
    expect(pendingRequest.status).toBe('expired');
    expect(pendingRequest.rejectionReason).toBe('expired');
    expect(pendingRequest.answeredAt).toEqual(now);
    expect(recordSpy).toHaveBeenCalledWith(
      manager,
      'request.expired',
      pendingRequest,
      trip,
    );
  });

  it('returns 0 when no pending requests are found', async () => {
    const queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setLock: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const manager = {
      createQueryBuilder: () => queryBuilder,
    } as unknown as EntityManager;

    const dataSource = {
      transaction: async (
        cb: (m: EntityManager) => Promise<unknown>,
      ): Promise<unknown> => cb(manager),
    } as unknown as DataSource;

    const changes = {
      record: recordSpy,
    } as unknown as RequestChangesRecorder;

    scheduler = new RequestLifecycleScheduler(dataSource, changes);
    const count = await scheduler.expirePendingRequests();

    expect(count).toBe(0);
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
