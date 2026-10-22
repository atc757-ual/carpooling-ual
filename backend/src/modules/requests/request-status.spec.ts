import { InvalidRequestTransitionError } from './errors/invalid-request-transition.error';
import {
  assertRequestTransition,
  canRequestTransition,
  REQUEST_STATUSES,
  RequestStatus,
} from './request-status';

// RNF-10: se prueban TODAS las combinaciones de estados (4 x 4 = 16). Las
// permitidas son las del diagrama de estados de la solicitud; el resto se
// rechaza
const ALLOWED: [RequestStatus, RequestStatus][] = [
  ['pending', 'accepted'],
  ['pending', 'rejected'],
  ['pending', 'cancelled'],
  ['accepted', 'cancelled'],
];

const ALL_PAIRS = REQUEST_STATUSES.flatMap((from) =>
  REQUEST_STATUSES.map((to): [RequestStatus, RequestStatus] => [from, to]),
);
const isAllowed = ([from, to]: [RequestStatus, RequestStatus]): boolean =>
  ALLOWED.some(([a, b]) => a === from && b === to);

describe('seat request status machine', () => {
  it('covers the 16 combinations of states', () => {
    expect(ALL_PAIRS).toHaveLength(16);
  });

  it.each(ALL_PAIRS.filter(isAllowed))('allows %s → %s', (from, to) => {
    expect(canRequestTransition(from, to)).toBe(true);
    expect(() => assertRequestTransition(from, to)).not.toThrow();
  });

  it.each(ALL_PAIRS.filter((pair) => !isAllowed(pair)))(
    'rejects %s → %s with INVALID_REQUEST_TRANSITION',
    (from, to) => {
      expect(canRequestTransition(from, to)).toBe(false);
      expect(() => assertRequestTransition(from, to)).toThrow(
        InvalidRequestTransitionError,
      );
    },
  );
});
