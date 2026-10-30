import { Trip } from './entities/trip.entity';
import {
  findSuspensionEnd,
  isLateDriverCancellation,
} from './late-cancellations.service';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const NOW = new Date('2026-11-10T08:00:00Z');

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

function trip(status: Trip['status'], minutesToDeparture: number): Trip {
  return {
    status,
    departureAt: new Date(NOW.getTime() + minutesToDeparture * MINUTE_MS),
  } as Trip;
}

// La regla de las cancelaciones tardías, sin base de datos (el resto, en
// test/trips-service.e2e-spec.ts)
describe('late cancellations', () => {
  describe('isLateDriverCancellation', () => {
    it('is late with accepted passengers and less than 30 minutes left', () => {
      expect(isLateDriverCancellation(trip('confirmed', 29), NOW)).toBe(true);
    });

    it('is not late from 30 minutes on', () => {
      expect(isLateDriverCancellation(trip('confirmed', 30), NOW)).toBe(false);
      expect(isLateDriverCancellation(trip('confirmed', 31), NOW)).toBe(false);
    });

    it('is never late without accepted passengers', () => {
      expect(isLateDriverCancellation(trip('published', 5), NOW)).toBe(false);
    });
  });

  describe('findSuspensionEnd', () => {
    it('does not suspend with fewer than 3 in 30 days', () => {
      expect(findSuspensionEnd([], NOW)).toBeNull();
      expect(findSuspensionEnd([daysAgo(1), daysAgo(2)], NOW)).toBeNull();
    });

    it('suspends for 7 days from the last of 3 in 30 days', () => {
      const dates = [daysAgo(1), daysAgo(10), daysAgo(20)];

      expect(findSuspensionEnd(dates, NOW)).toEqual(
        new Date(daysAgo(1).getTime() + 7 * DAY_MS),
      );
    });

    it('ends after the 7 days', () => {
      const dates = [daysAgo(8), daysAgo(10), daysAgo(20)];

      expect(findSuspensionEnd(dates, NOW)).toBeNull();
    });

    it('counts the 30 days before the last one, not before today', () => {
      // La 1.ª salió de los 30 días de hoy, pero no de los de la última
      const dates = [daysAgo(2), daysAgo(20), daysAgo(31)];

      expect(findSuspensionEnd(dates, NOW)).toEqual(
        new Date(daysAgo(2).getTime() + 7 * DAY_MS),
      );
    });

    it('ignores cancellations older than 30 days before the last one', () => {
      const dates = [daysAgo(1), daysAgo(2), daysAgo(40)];

      expect(findSuspensionEnd(dates, NOW)).toBeNull();
    });
  });
});
