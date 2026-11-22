import type { Commuter, Driver } from './population';
import {
  addPickup,
  detourWith,
  distanceToRouteKm,
  findRide,
  RideOffer,
  stopsOf,
  travelMin,
} from './ride-matcher';
import {
  DEFAULT_MAX_DETOUR_M,
  MAX_TRIP_STOPS,
  STOP_TIME_MIN,
} from '../../trips/trip-timing';

const ARRIVAL = 8 * 60;
const DEPARTURE = 15 * 60;
// Sin límite de distancia a la ruta: para probar solo el presupuesto de desvío
const ANY_DISTANCE_M = 50_000;

function passenger(x: number, desiredArrivalMin = ARRIVAL): Commuter {
  return {
    id: 'p',
    origin: { x, y: 0 },
    desiredArrivalMin,
    desiredDepartureMin: DEPARTURE,
    windowMin: 15,
  };
}

function at(x: number, y: number): Commuter {
  return { ...passenger(x), origin: { x, y } };
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
    desiredDepartureMin: DEPARTURE,
    windowMin: 15,
    seats: 3,
  };
  return {
    driver,
    leg: 'to-campus',
    pickupMode: 'on_route',
    maxDetourM: DEFAULT_MAX_DETOUR_M,
    stops: [],
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

describe('distanceToRouteKm', () => {
  it('measures from the straight route between the driver and the campus', () => {
    const { driver } = offer('d', 6);

    expect(distanceToRouteKm(driver, { x: 3, y: 0.4 })).toBeCloseTo(0.4);
    // Más allá de la salida, hasta la salida
    expect(distanceToRouteKm(driver, { x: 9, y: 4 })).toBeCloseTo(5);
    expect(
      distanceToRouteKm({ ...driver, origin: { x: 0, y: 0 } }, { x: 3, y: 4 }),
    ).toBeCloseTo(5);
  });
});

describe('findRide', () => {
  it('picks the driver with the smallest detour', () => {
    const near = offer('near', 6);
    const far = offer('far', -6, { maxDetourM: ANY_DISTANCE_M });

    expect(findRide(passenger(5), [far, near])).toEqual({
      offer: near,
      meetingPoint: { x: 5, y: 0 },
    });
  });

  it('only picks up near the route, as far as the driver goes out of the way', () => {
    const driver = offer('d', 6);
    // A 400 m de la ruta: más de los 300 m por defecto, pero no de 500
    expect(findRide(at(3, 0.4), [driver])).toBeNull();
    expect(
      findRide(at(3, 0.4), [offer('d', 6, { maxDetourM: 500 })]),
    ).not.toBeNull();
    expect(findRide(at(3, 0.2), [driver])).not.toBeNull();
  });

  it('rejects a detour over 10 minutes', () => {
    const anywhere = { maxDetourM: ANY_DISTANCE_M };
    expect(
      findRide(passenger(0, ARRIVAL), [
        offer('d', 0, anywhere),
        offer('x', 20, anywhere),
      ]),
    ).not.toBeNull();
    expect(findRide(at(0, 9), [offer('x', 9, anywhere)])).toBeNull();
  });

  it('rejects a driver out of the time window', () => {
    expect(findRide(passenger(5, ARRIVAL + 30), [offer('d', 6)])).toBeNull();
  });

  it('charges the stop time to a passenger right on the driver way', () => {
    const driver = offer('d', 6);
    const onTheWay = passenger(3);

    expect(findRide(onTheWay, [driver])?.offer).toBe(driver);
    expect(detourWith(driver, onTheWay.origin)).toBeCloseTo(STOP_TIME_MIN);
  });

  it('fits every pickup of a trip in one detour budget', () => {
    const anywhere = { maxDetourM: ANY_DISTANCE_M };
    const driver = offer('d', 6, anywhere);
    // 3 km a cada lado de la ruta: ~5 min de desvío y 2 de parada cada uno
    // (≈ 7 ≤ 10); los dos juntos, ≈ 19 min
    const first = at(4, 3);
    const second = { ...at(2, -3), id: 'p2' };

    expect(findRide(first, [driver])?.offer).toBe(driver);
    addPickup(driver, first.origin);

    // Solo, el segundo cabría; con el primero, el viaje se pasa de 10 min
    expect(findRide(second, [offer('alone', 6, anywhere)])).not.toBeNull();
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

  it('with stops, the passenger walks to the nearest one, 800 m at most', () => {
    const base = offer('d', 10);
    const withStops = offer('d', 10, {
      pickupMode: 'stops',
      stops: stopsOf(base.driver),
    });
    expect(withStops.stops).toHaveLength(MAX_TRIP_STOPS);

    // Las paradas, cada 2 km desde la salida (10, 8, 6, 4 y 2 km del campus)
    const near = findRide(at(6.3, 0.6), [withStops]);
    expect(near?.meetingPoint).toEqual({ x: 6, y: 0 });
    expect(findRide(at(5, 0.6), [withStops])).toBeNull();
    // Sin paradas, nadie encaja
    expect(findRide(at(6, 0), [{ ...withStops, stops: [] }])).toBeNull();
  });

  it('on the way back, leaves from campus at its time and drops off near the route', () => {
    const back = offer('d', 6, { leg: 'from-campus' });

    // A 700 m de la ruta: no a la ida (300 m), sí a la vuelta (800 m)
    expect(findRide(at(3, 0.7), [offer('d', 6)])).toBeNull();
    expect(findRide(at(3, 0.7), [back])?.offer).toBe(back);
    // Cuenta la hora de salida del campus, no la de llegada
    const late = { ...at(3, 0.1), desiredDepartureMin: DEPARTURE + 60 };
    expect(findRide(late, [back])).toBeNull();
  });
});
