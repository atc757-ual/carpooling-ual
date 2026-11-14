import {
  estimateSharedArrival,
  generateShareToken,
  hashShareToken,
  isSharedTripVisible,
  isWellFormedShareToken,
  SHARE_TTL_AFTER_END_MS,
  toSharedPassengerState,
} from './trip-share-rules';

const NOW = new Date('2026-11-14T10:00:00Z');
const ENDED_AT = new Date('2026-11-14T09:00:00Z');
const LONG_AGO = new Date(NOW.getTime() - SHARE_TTL_AFTER_END_MS - 1);

describe('trip share rules', () => {
  it('generates different well-formed tokens', () => {
    const [first, second] = [generateShareToken(), generateShareToken()];

    expect(isWellFormedShareToken(first)).toBe(true);
    expect(first).not.toBe(second);
  });

  it('rejects malformed tokens', () => {
    expect(isWellFormedShareToken('abc')).toBe(false);
    expect(isWellFormedShareToken(`${'a'.repeat(42)}/`)).toBe(false);
  });

  it('hashes the token with SHA-256 in hex', () => {
    expect(hashShareToken('token')).toMatch(/^[0-9a-f]{64}$/);
    expect(hashShareToken('token')).toBe(hashShareToken('token'));
  });

  describe('isSharedTripVisible', () => {
    const accepted = { status: 'accepted' as const };
    const cancelled = { status: 'cancelled' as const };

    it.each([
      ['confirmed', accepted, null, true],
      ['in_progress', accepted, null, true],
      ['confirmed', cancelled, null, false],
      ['finished', accepted, ENDED_AT, true],
      ['finished', accepted, LONG_AGO, false],
      ['finished', cancelled, ENDED_AT, false],
      ['cancelled', cancelled, null, true],
      ['published', cancelled, null, false],
      ['expired', accepted, null, false],
    ] as const)(
      '%s trip with a %o request (ended %s): %s',
      (status, request, finishedAt, expected) => {
        const trip = { status, finishedAt, updatedAt: ENDED_AT };

        expect(isSharedTripVisible(trip, request, NOW)).toBe(expected);
      },
    );

    it('hides a cancelled trip 24 hours later', () => {
      const trip = {
        status: 'cancelled' as const,
        finishedAt: null,
        updatedAt: LONG_AGO,
      };

      expect(isSharedTripVisible(trip, cancelled, NOW)).toBe(false);
    });

    it('hides it without a request', () => {
      const trip = {
        status: 'confirmed' as const,
        finishedAt: null,
        updatedAt: NOW,
      };

      expect(isSharedTripVisible(trip, null, NOW)).toBe(false);
    });
  });

  it.each([
    ['confirmed', null, 'waiting'],
    ['in_progress', null, 'waiting'],
    ['in_progress', NOW, 'on_board'],
    ['finished', NOW, 'finished'],
    ['cancelled', null, 'finished'],
  ] as const)('%s trip, boarded %s: %s', (status, boardedAt, expected) => {
    expect(toSharedPassengerState(status, boardedAt)).toBe(expected);
  });

  describe('estimateSharedArrival', () => {
    const trip = {
      departureAt: new Date('2026-11-14T10:30:00Z'),
      startedAt: null,
    };

    it('uses the position when there is one', () => {
      const position = { recordedAt: NOW, remainingMin: 5 };

      expect(estimateSharedArrival(trip, position, 20)).toEqual(
        new Date('2026-11-14T10:05:00Z'),
      );
    });

    it('uses the start (or the departure) and the route otherwise', () => {
      expect(estimateSharedArrival(trip, null, 20)).toEqual(
        new Date('2026-11-14T10:50:00Z'),
      );
      expect(
        estimateSharedArrival({ ...trip, startedAt: NOW }, null, 20),
      ).toEqual(new Date('2026-11-14T10:20:00Z'));
    });

    it('is unknown without a route', () => {
      expect(estimateSharedArrival(trip, null, null)).toBeNull();
    });
  });
});
