import { DailyTripLimitError } from './errors/daily-trip-limit.error';
import { TripOverlapsError } from './errors/trip-overlaps.error';
import { assertNoOverlap, MAX_TRIPS_PER_DAY } from './publishing-limits';

const departure = new Date('2026-11-01T10:00:00.000Z');

describe('publishing limits', () => {
  it('sets the daily limit to four trips', () => {
    expect(MAX_TRIPS_PER_DAY).toBe(4);
    expect(new DailyTripLimitError(MAX_TRIPS_PER_DAY).code).toBe(
      'DAILY_TRIP_LIMIT',
    );
  });

  it('counts the detour window when checking overlap', () => {
    expect(() =>
      assertNoOverlap(
        { id: '', departureAt: departure, durationMin: 30, maxDetourMin: 10 },
        [
          {
            id: 'existing-trip',
            departureAt: new Date('2026-11-01T10:35:00.000Z'),
            durationMin: 15,
            maxDetourMin: 5,
            status: 'published',
          },
        ],
      ),
    ).toThrow(TripOverlapsError);
  });

  it('allows trips whose intervals only touch at an endpoint', () => {
    expect(() =>
      assertNoOverlap(
        { id: '', departureAt: departure, durationMin: 30, maxDetourMin: 10 },
        [
          {
            id: 'next-trip',
            departureAt: new Date('2026-11-01T10:40:00.000Z'),
            durationMin: 10,
            maxDetourMin: 0,
            status: 'confirmed',
          },
        ],
      ),
    ).not.toThrow();
  });

  it('ignores cancelled, finished, and the trip being edited', () => {
    for (const status of ['cancelled', 'finished', 'in_progress'] as const) {
      const candidateId = status === 'in_progress' ? 'existing-trip' : '';
      expect(() =>
        assertNoOverlap(
          {
            id: candidateId,
            departureAt: departure,
            durationMin: 20,
            maxDetourMin: 0,
            status: 'published',
          },
          [
            {
              id: 'existing-trip',
              departureAt: new Date('2026-11-01T10:10:00.000Z'),
              durationMin: 20,
              maxDetourMin: 0,
              status,
            },
          ],
        ),
      ).not.toThrow();
    }
  });
});
