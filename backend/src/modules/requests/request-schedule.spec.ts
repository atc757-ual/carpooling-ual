import {
  MAX_OVERLAPPING_PENDING_REQUESTS,
  schedulesOverlap,
} from './request-schedule';

describe('request schedule overlap', () => {
  const schedule = (departureAt: string, durationMin: number) => ({
    departureAt: new Date(departureAt),
    durationMin,
  });

  it('counts trips that intersect during their travel time', () => {
    expect(
      schedulesOverlap(
        schedule('2026-10-31T08:00:00Z', 30),
        schedule('2026-10-31T08:20:00Z', 20),
      ),
    ).toBe(true);
  });

  it('does not count trips that meet at the same end and start time', () => {
    expect(
      schedulesOverlap(
        schedule('2026-10-31T08:00:00Z', 30),
        schedule('2026-10-31T08:30:00Z', 20),
      ),
    ).toBe(false);
  });

  it('sets the pending overlap limit to three', () => {
    expect(MAX_OVERLAPPING_PENDING_REQUESTS).toBe(3);
  });
});
