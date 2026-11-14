import type { Point } from 'typeorm';
import { ReturnTripRejectedError } from './errors/return-trip-rejected.error';
import { TripOverlapsError } from './errors/trip-overlaps.error';
import { asReturnLeg, toReturnTripInput } from './return-trip';
import type { TripInput } from './trips.service';

const CENTRE: Point = { type: 'Point', coordinates: [-2.46, 36.84] };
const CAMPUS: Point = { type: 'Point', coordinates: [-2.41, 36.83] };
const OUTBOUND: TripInput = {
  vehicleId: 'v1',
  origin: CENTRE,
  destination: CAMPUS,
  originName: 'Almería centro',
  destinationName: 'Campus UAL · P1',
  departureAt: new Date('2099-01-15T07:30:00Z'),
  offeredSeats: 3,
  maxDetourMin: 15,
  pickupMode: 'on_route',
  maxDetourM: 1000,
};
const RETURN_AT = new Date('2099-01-15T14:30:00Z');

describe('toReturnTripInput', () => {
  it('swaps origin and destination and keeps the vehicle and the detour', () => {
    expect(
      toReturnTripInput(OUTBOUND, { departureAt: RETURN_AT, offeredSeats: 2 }),
    ).toEqual({
      vehicleId: 'v1',
      origin: CAMPUS,
      destination: CENTRE,
      originName: 'Campus UAL · P1',
      destinationName: 'Almería centro',
      departureAt: RETURN_AT,
      offeredSeats: 2,
      maxDetourMin: 15,
      pickupMode: 'on_route',
      maxDetourM: 1000,
    });
  });

  it('picks up on the route when the outbound trip uses stops', () => {
    expect(
      toReturnTripInput(
        { ...OUTBOUND, pickupMode: 'stops', maxDetourM: undefined },
        { departureAt: RETURN_AT, offeredSeats: 2 },
      ),
    ).toMatchObject({ pickupMode: 'on_route', maxDetourM: 500 });
  });
});

describe('asReturnLeg', () => {
  it('tells a business error apart as one of the return trip', async () => {
    const overlap = new TripOverlapsError(new Date('2099-01-15T08:00:00Z'));
    const rejected = asReturnLeg(() => Promise.reject(overlap));

    await expect(rejected).rejects.toBeInstanceOf(ReturnTripRejectedError);
    await expect(rejected).rejects.toMatchObject({
      code: 'RETURN_TRIP_REJECTED',
      kind: 'conflict',
      cause: overlap,
    });
  });

  it('lets other errors through and returns the result', async () => {
    const unexpected = new Error('database down');
    await expect(asReturnLeg(() => Promise.reject(unexpected))).rejects.toBe(
      unexpected,
    );
    await expect(asReturnLeg(() => Promise.resolve(7))).resolves.toBe(7);
  });
});
