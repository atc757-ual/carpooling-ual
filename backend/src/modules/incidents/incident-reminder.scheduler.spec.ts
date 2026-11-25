import type { DataSource, EntityManager } from 'typeorm';
import type { TripsService } from '../trips/trips.service';
import type { IncidentNoticesService } from './incident-notices.service';
import { IncidentReminderScheduler } from './incident-reminder.scheduler';

describe('IncidentReminderScheduler', () => {
  // find(Incident, { where, order })
  const find = jest.fn<
    Promise<unknown[]>,
    [unknown, { where: { status: string; createdAt: { value: Date } } }]
  >();
  const manager = { find } as unknown as EntityManager;
  const dataSource = {
    transaction: (work: (manager: EntityManager) => Promise<number>) =>
      work(manager),
  } as unknown as DataSource;
  const getByIds = jest.fn();
  const remindUntaken = jest.fn();

  function scheduler(): IncidentReminderScheduler {
    return new IncidentReminderScheduler(
      dataSource,
      { getByIds } as unknown as TripsService,
      { remindUntaken } as unknown as IncidentNoticesService,
    );
  }

  beforeEach(() => jest.clearAllMocks());

  it('reminds the incidents registered 24 h ago or more, counting the reminded ones', async () => {
    const now = new Date('2026-11-25T10:00:00.000Z');
    find.mockResolvedValue([
      { id: 'i1', tripId: 't1' },
      { id: 'i2', tripId: 't2' },
    ]);
    getByIds.mockResolvedValue(new Map([['t1', { driverId: 'd1' }]]));
    remindUntaken.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    expect(await scheduler().remindUntaken(now)).toBe(1);

    const { where } = find.mock.calls[0][1];
    expect(where.status).toBe('open');
    expect(where.createdAt.value).toEqual(new Date('2026-11-24T10:00:00.000Z'));
    expect(remindUntaken).toHaveBeenNthCalledWith(
      1,
      manager,
      { id: 'i1', tripId: 't1' },
      'd1',
    );
    // Sin viaje (borrado), sin conductor que excluir
    expect(remindUntaken).toHaveBeenNthCalledWith(
      2,
      manager,
      { id: 'i2', tripId: 't2' },
      '',
    );
  });

  it('logs only when it reminded something', async () => {
    find.mockResolvedValue([]);
    getByIds.mockResolvedValue(new Map());

    await expect(scheduler().handleCron()).resolves.toBeUndefined();
    expect(remindUntaken).not.toHaveBeenCalled();
  });
});
