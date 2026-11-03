import { Logger } from '@nestjs/common';
import type { DomainEvent } from '../../../events/entities/domain-event.entity';
import {
  EventsService,
  MAX_EVENTS_PER_READ,
} from '../../../events/events.service';
import { DigitalTwinSyncService } from './digital-twin-sync.service';
import { GAP_WAIT_MS } from './sequence-gaps';

const NOW = Date.UTC(2026, 10, 3, 8, 0, 0);

function event(sequence: number, ageMs = 0): DomainEvent {
  return {
    id: `event-${sequence}`,
    sequence,
    type: 'trip.published',
    version: 1,
    sourceEntityId: `t-${sequence}`,
    payload: { vehicleId: 'v-1', status: 'published' },
    occurredAt: new Date(NOW - ageMs),
  };
}

describe('DigitalTwinSyncService', () => {
  let store: DomainEvent[];
  let readAfter: jest.Mock<Promise<DomainEvent[]>, [number]>;
  let service: DigitalTwinSyncService;

  beforeEach(() => {
    store = [];
    readAfter = jest.fn((sequence: number) =>
      Promise.resolve(
        store
          .filter((e) => e.sequence > sequence)
          .slice(0, MAX_EVENTS_PER_READ),
      ),
    );
    service = new DigitalTwinSyncService({
      readAfter,
    } as unknown as EventsService);
  });

  it('replays from the beginning in pages without measuring the lag', async () => {
    for (let sequence = 1; sequence <= MAX_EVENTS_PER_READ + 3; sequence += 1) {
      store.push(event(sequence, 60_000));
    }

    await service.syncOnce(() => NOW);

    expect(readAfter.mock.calls.map(([sequence]) => sequence)).toEqual([
      0,
      MAX_EVENTS_PER_READ,
    ]);
    expect(service.twin.summary().trips.published).toBe(
      MAX_EVENTS_PER_READ + 3,
    );
    expect(service.status()).toEqual({
      isLive: true,
      syncedAt: new Date(NOW),
      lag: { samples: 0, lastMs: null, p95Ms: null, maxMs: null },
    });
  });

  it('measures the lag of the events that arrive once live', async () => {
    await service.syncOnce(() => NOW);
    store.push(event(1, 120), event(2, 80));

    await service.syncOnce(() => NOW);

    expect(service.status().lag).toEqual({
      samples: 2,
      lastMs: 80,
      p95Ms: 120,
      maxMs: 120,
    });
  });

  it('waits for a recent gap and reads again from before it', async () => {
    await service.syncOnce(() => NOW);
    store.push(event(1), event(3));

    await service.syncOnce(() => NOW);
    expect(service.twin.lastSequence).toBe(1);

    store.push(event(2));
    store.sort((a, b) => a.sequence - b.sequence);
    await service.syncOnce(() => NOW + 100);
    expect(service.twin.lastSequence).toBe(3);
    expect(service.twin.summary().appliedEvents).toBe(3);
  });

  it('gives a gap up for lost after waiting', async () => {
    await service.syncOnce(() => NOW);
    store.push(event(1), event(3));
    await service.syncOnce(() => NOW);

    await service.syncOnce(() => NOW + GAP_WAIT_MS);

    expect(service.twin.lastSequence).toBe(3);
  });

  it('does not overlap two polls and logs a failed read', async () => {
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    let release: () => void = () => undefined;
    readAfter.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );

    const first = service.poll();
    await service.poll();
    expect(readAfter).toHaveBeenCalledTimes(1);
    release();
    await first;

    readAfter.mockRejectedValueOnce(new Error('database down'));
    await service.poll();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
