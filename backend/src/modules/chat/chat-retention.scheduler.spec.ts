import type { DataSource } from 'typeorm';
import type { Trip } from '../trips/entities/trip.entity';
import type { TripsService } from '../trips/trips.service';
import { CHAT_RETENTION_MS } from './chat-rules';
import { ChatRetentionScheduler } from './chat-retention.scheduler';

const NOW = new Date('2026-12-15T03:00:00Z');
const OLD = new Date(NOW.getTime() - CHAT_RETENTION_MS - 1000);
const RECENT = new Date(NOW.getTime() - 1000);

function trip(id: string, overrides: Partial<Trip>): Trip {
  return {
    id,
    status: 'finished',
    finishedAt: OLD,
    updatedAt: OLD,
    ...overrides,
  } as Trip;
}

describe('ChatRetentionScheduler', () => {
  let deletes: { entity: unknown; where: unknown }[];
  let affected: number | undefined;
  let tripsWithMessages: Trip[];
  let scheduler: ChatRetentionScheduler;

  beforeEach(() => {
    deletes = [];
    affected = 2;
    const manager = {
      delete: jest.fn((entity: unknown, where: unknown) => {
        deletes.push({ entity, where });
        return Promise.resolve({ affected });
      }),
    };
    const dataSource = {
      getRepository: () => ({
        createQueryBuilder: () => ({
          select: () => ({
            getRawMany: () =>
              Promise.resolve(
                tripsWithMessages.map(({ id }) => ({ tripId: id })),
              ),
          }),
        }),
      }),
      transaction: (work: (m: typeof manager) => Promise<number>) =>
        work(manager),
    } as unknown as DataSource;
    const tripsService = {
      getByIds: () =>
        Promise.resolve(new Map(tripsWithMessages.map((t) => [t.id, t]))),
    } as unknown as TripsService;
    scheduler = new ChatRetentionScheduler(dataSource, tripsService);
  });

  it('only purges the trips that finished or were cancelled more than 30 days ago', async () => {
    tripsWithMessages = [
      trip('finished-old', {}),
      trip('finished-recent', { finishedAt: RECENT }),
      // Cancelado: sin finished_at, cuenta el último cambio
      trip('cancelled-old', { status: 'cancelled', finishedAt: null }),
      trip('in-progress', { status: 'in_progress', finishedAt: null }),
      trip('confirmed', { status: 'confirmed', finishedAt: null }),
    ];

    await expect(scheduler.purgeExpired(NOW)).resolves.toBe(2);

    expect(deletes).toHaveLength(2);
    expect(JSON.stringify(deletes[0].where)).toContain('finished-old');
    expect(JSON.stringify(deletes[0].where)).toContain('cancelled-old');
    expect(JSON.stringify(deletes[0].where)).not.toContain('finished-recent');
    expect(JSON.stringify(deletes[0].where)).not.toContain('in-progress');
  });

  it('does nothing without expired chats and counts 0 when nothing was deleted', async () => {
    tripsWithMessages = [
      trip('confirmed', { status: 'confirmed', finishedAt: null }),
    ];
    await expect(scheduler.purgeExpired(NOW)).resolves.toBe(0);
    expect(deletes).toHaveLength(0);

    tripsWithMessages = [trip('finished-old', {})];
    affected = undefined;
    await expect(scheduler.purgeExpired(NOW)).resolves.toBe(0);
  });

  it('logs how many messages the daily run deleted, and nothing when none', async () => {
    const log = jest
      .spyOn(scheduler['logger'], 'log')
      .mockImplementation(() => undefined);
    // handleCron usa la hora real: un viaje de hace años
    const longAgo = new Date('2020-01-01T00:00:00Z');
    tripsWithMessages = [
      trip('finished-old', { finishedAt: longAgo, updatedAt: longAgo }),
    ];
    await scheduler.handleCron();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('Borrados 2 mensajes'),
    );

    log.mockClear();
    tripsWithMessages = [];
    await scheduler.handleCron();
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});
