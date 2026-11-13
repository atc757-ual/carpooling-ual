import type { TripCandidate } from '../candidate-source';
import type { TripMatch } from '../matching.service';
import { toTripMatchResource } from './trip-match.resource';

const CANDIDATE: TripCandidate = {
  tripId: 't1',
  driverId: 'd1',
  vehicleId: 'v1',
  departureAt: new Date('2026-11-20T07:30:00Z'),
  durationMin: 20,
  detourMin: 6,
  maxDetourMin: 10,
  offeredSeats: 3,
  availableSeats: 2,
  driverTripCount: 4,
  origin: { type: 'Point', coordinates: [-2.46, 36.84] },
  destination: { type: 'Point', coordinates: [-2.4, 36.83] },
  distanceKm: 0.3,
  pickupAt: new Date('2026-11-20T07:37:00Z'),
};

function match(candidate: TripCandidate): TripMatch {
  return {
    match: { candidate, timeDifferenceMin: 0, score: 0.9 },
    driverName: 'Lucía C.',
    driverAvatarKey: null,
    driverPreferences: {},
    driverRating: null,
    vehicle: null,
  } as unknown as TripMatch;
}

describe('toTripMatchResource', () => {
  it('gives the estimated pickup time and the arrival with the whole detour', () => {
    const resource = toTripMatchResource(match(CANDIDATE));

    expect(resource.pickupAt).toBe('2026-11-20T07:37:00.000Z');
    // 07:30 + 20 de ruta directa + 6 de desvío total
    expect(resource.arrivalAt).toBe('2026-11-20T07:56:00.000Z');
  });

  it('has no pickup time when everybody boards at the campus', () => {
    const resource = toTripMatchResource(
      match({ ...CANDIDATE, pickupAt: null }),
    );

    expect(resource.pickupAt).toBeNull();
  });
});
