import type { Commuter, Driver } from './population';
import {
  addPickup,
  detourWith,
  findRide,
  RideOffer,
  travelMin,
} from './ride-matcher';
import { STOP_TIME_MIN } from '../../trips/trip-timing';

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
    pickups: [],
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

  it('charges the stop time to a passenger right on the driver way', () => {
    const driver = offer('d', 6);
    const onTheWay = passenger(3);

    expect(findRide(onTheWay, [driver])).toBe(driver);
    expect(detourWith(driver, onTheWay.origin)).toBeCloseTo(STOP_TIME_MIN);
  });

  it('fits every pickup of a trip in one detour budget', () => {
    const driver = offer('d', 6);
    // 3 km a cada lado de la ruta: ~5 min de desvío y 2 de parada cada uno
    // (≈ 7 ≤ 10); los dos juntos, ≈ 19 min
    const first = { ...passenger(4), origin: { x: 4, y: 3 } };
    const second = { ...passenger(2), id: 'p2', origin: { x: 2, y: -3 } };

    expect(findRide(first, [driver])).toBe(driver);
    addPickup(driver, first.origin);

    // Solo, el segundo cabría; con el primero, el viaje se pasa de 10 min
    expect(findRide(second, [offer('alone', 6)])).not.toBeNull();
    expect(findRide(second, [driver])).toBeNull();
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
