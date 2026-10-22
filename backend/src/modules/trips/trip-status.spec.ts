import { InvalidTripTransitionError } from './errors/invalid-trip-transition.error';
import {
  assertTransition,
  canTransition,
  TRIP_STATUSES,
  TripStatus,
} from './trip-status';

// RNF-10: se prueban TODAS las combinaciones de estados (5 x 5 = 25). Las
// permitidas son las del diagrama de estados del viaje; el resto se rechaza
const ALLOWED: [TripStatus, TripStatus][] = [
  ['published', 'confirmed'],
  ['published', 'cancelled'],
  ['confirmed', 'in_progress'],
  ['confirmed', 'published'],
  ['confirmed', 'cancelled'],
  ['in_progress', 'finished'],
  ['in_progress', 'cancelled'],
];

const ALL_PAIRS = TRIP_STATUSES.flatMap((from) =>
  TRIP_STATUSES.map((to): [TripStatus, TripStatus] => [from, to]),
);
const isAllowed = ([from, to]: [TripStatus, TripStatus]): boolean =>
  ALLOWED.some(([a, b]) => a === from && b === to);

describe('trip status machine', () => {
  it('covers the 25 combinations of states', () => {
    expect(ALL_PAIRS).toHaveLength(25);
  });

  it.each(ALL_PAIRS.filter(isAllowed))('allows %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true);
    expect(() => assertTransition(from, to)).not.toThrow();
  });

  it.each(ALL_PAIRS.filter((pair) => !isAllowed(pair)))(
    'rejects %s → %s with INVALID_TRIP_TRANSITION',
    (from, to) => {
      expect(canTransition(from, to)).toBe(false);
      expect(() => assertTransition(from, to)).toThrow(
        InvalidTripTransitionError,
      );
    },
  );
});
