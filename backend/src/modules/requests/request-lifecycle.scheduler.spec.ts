import { DataSource, EntityManager } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import type { TripLookupService } from '../trips/trip-lookup.service';
import { SeatRequest } from './entities/seat-request.entity';
import { RequestChangesRecorder } from './request-changes';
import { RequestLifecycleScheduler } from './request-lifecycle.scheduler';

describe('RequestLifecycleScheduler', () => {
  const recordSpy = jest.fn().mockResolvedValue(undefined);
  const changes = { record: recordSpy } as unknown as RequestChangesRecorder;
  // Las 09:00: un viaje sale en 20 min (caduca) y otro en 2 horas (no)
  const now = new Date('2026-11-03T09:00:00Z');
  const soon = {
    id: 'trip-soon',
    departureAt: new Date('2026-11-03T09:08:00Z'),
  } as Trip;
  const later = {
    id: 'trip-later',
    departureAt: new Date('2026-11-03T09:20:00Z'),
  } as Trip;

  function schedulerWith(pending: SeatRequest[]) {
    const find = jest
      .fn()
      // Las pendientes (id y viaje) y, después, las que tocan, bloqueadas
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(
        pending.filter(({ tripId }) => tripId === soon.id),
      );
    const manager = {
      find,
      save: (items: unknown) => Promise.resolve(items),
    } as unknown as EntityManager;
    const dataSource = {
      transaction: (cb: (m: EntityManager) => Promise<unknown>) => cb(manager),
    } as unknown as DataSource;
    const tripLookup = {
      findByIds: jest.fn().mockResolvedValue(
        new Map([
          [soon.id, soon],
          [later.id, later],
        ]),
      ),
    } as unknown as TripLookupService;
    return {
      scheduler: new RequestLifecycleScheduler(dataSource, changes, tripLookup),
      find,
      manager,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('expires the pending requests once their trip passes the cutoff (10 min before departure)', async () => {
    const due = {
      id: 'req-1',
      tripId: soon.id,
      status: 'pending',
    } as SeatRequest;
    const notYet = {
      id: 'req-2',
      tripId: later.id,
      status: 'pending',
    } as SeatRequest;
    const { scheduler, find, manager } = schedulerWith([due, notYet]);

    const expiredCount = await scheduler.expirePendingRequests(now);

    expect(expiredCount).toBe(1);
    expect(due).toMatchObject({
      status: 'expired',
      rejectionReason: 'expired',
      answeredAt: now,
    });
    expect(notYet.status).toBe('pending');
    // Solo se bloquean las que caducan
    expect(find).toHaveBeenLastCalledWith(
      SeatRequest,
      expect.objectContaining({ lock: { mode: 'pessimistic_write' } }),
    );
    expect(recordSpy).toHaveBeenCalledWith(
      manager,
      'request.expired',
      due,
      soon,
    );
  });

  it('expires nothing when no pending request is due', async () => {
    const notYet = {
      id: 'req-2',
      tripId: later.id,
      status: 'pending',
    } as SeatRequest;
    const { scheduler, find } = schedulerWith([notYet]);

    expect(await scheduler.expirePendingRequests(now)).toBe(0);
    expect(find).toHaveBeenCalledTimes(1);
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it('expires nothing when there are no pending requests', async () => {
    const { scheduler } = schedulerWith([]);

    expect(await scheduler.expirePendingRequests(now)).toBe(0);
    expect(recordSpy).not.toHaveBeenCalled();
  });
});
