import type { TwinEvent } from '../model/twin-event';
import { GAP_WAIT_MS, selectReady } from './sequence-gaps';

const NOW = Date.UTC(2026, 10, 3, 8, 0, 0);

function event(sequence: number, ageMs = 0): TwinEvent {
  return {
    id: `event-${sequence}`,
    sequence,
    type: 'trip.updated',
    version: 1,
    sourceEntityId: 't-1',
    payload: {},
    occurredAt: new Date(NOW - ageMs),
  };
}

function sequences(events: readonly TwinEvent[]): number[] {
  return events.map((e) => e.sequence);
}

describe('selectReady', () => {
  it('returns the contiguous events', () => {
    const { ready, gap } = selectReady(
      [event(4), event(5), event(6)],
      3,
      null,
      NOW,
    );

    expect(sequences(ready)).toEqual([4, 5, 6]);
    expect(gap).toBeNull();
  });

  it('stops before a recent gap and remembers when it saw it', () => {
    const { ready, gap } = selectReady(
      [event(4), event(6), event(7)],
      3,
      null,
      NOW,
    );

    expect(sequences(ready)).toEqual([4]);
    expect(gap).toEqual({ afterSequence: 4, seenAt: NOW });
  });

  it('keeps the time of a gap it already saw', () => {
    const seenAt = NOW - 500;
    const { gap } = selectReady(
      [event(6)],
      4,
      { afterSequence: 4, seenAt },
      NOW,
    );

    expect(gap).toEqual({ afterSequence: 4, seenAt });
  });

  it('closes a gap that has been open long enough', () => {
    const { ready, gap } = selectReady(
      [event(6), event(7)],
      4,
      { afterSequence: 4, seenAt: NOW - GAP_WAIT_MS },
      NOW,
    );

    expect(sequences(ready)).toEqual([6, 7]);
    expect(gap).toBeNull();
  });

  it('closes at once a gap before an old event (replay)', () => {
    const { ready } = selectReady(
      [event(10, GAP_WAIT_MS), event(20, GAP_WAIT_MS)],
      0,
      null,
      NOW,
    );

    expect(sequences(ready)).toEqual([10, 20]);
  });

  it('ignores a remembered gap from another place', () => {
    const { gap } = selectReady(
      [event(9)],
      7,
      { afterSequence: 2, seenAt: NOW - GAP_WAIT_MS },
      NOW,
    );

    expect(gap).toEqual({ afterSequence: 7, seenAt: NOW });
  });
});
