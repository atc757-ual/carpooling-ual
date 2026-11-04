import type { Commuter, Driver } from './population';
import { findRide, RideOffer, travelMin } from './ride-matcher';

const ARRIVAL = 8 * 60;

function passenger(x: number, desiredArrivalMin = ARRIVAL): Commuter {
  return { id: 'p', origin: { x, y: 0 }, desiredArrivalMin, windowMin: 15 };
}

function offer(
  id: string,
  x: number,
  overrides: Partial<RideOffer> = {},
): RideOffer {
  const driver: Driver = {
    id,
    origin: { x, y: 0 },
    desiredArrivalMin: ARRIVAL,
    windowMin: 15,
    seats: 3,
  };
  return {
    driver,
    free: 3,
    isCancelled: false,
    passengerIds: [],
    ...overrides,
  };
}

describe('travelMin', () => {
  it('drives 1.3 times the straight line at 40 km/h', () => {
    expect(travelMin({ x: 0, y: 0 }, { x: 4, y: 3 })).toBeCloseTo(9.75);
  });
});

describe('findRide', () => {
  it('picks the driver with the smallest detour', () => {
    const near = offer('near', 6);
    const far = offer('far', -6);

    expect(findRide(passenger(5), [far, near])).toBe(near);
  });

  it('rejects a detour over 10 minutes', () => {
    expect(
      findRide(passenger(0, ARRIVAL), [offer('d', 0), offer('x', 20)]),
    ).not.toBeNull();
    expect(
      findRide({ ...passenger(0), origin: { x: 0, y: 9 } }, [offer('x', 9)]),
    ).toBeNull();
  });

  it('rejects a driver out of the time window', () => {
    expect(findRide(passenger(5, ARRIVAL + 30), [offer('d', 6)])).toBeNull();
  });

  it('skips full and cancelled trips', () => {
    expect(
      findRide(passenger(5), [
        offer('full', 6, { free: 0 }),
        offer('gone', 6, { isCancelled: true }),
      ]),
    ).toBeNull();
  });
});
