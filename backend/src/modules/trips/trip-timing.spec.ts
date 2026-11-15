import {
  departureForArrival,
  detourBudgetMin,
  resolveDeparture,
} from './trip-timing';

describe('detour budget', () => {
  const onRoute = { isStops: false, routeDetourMin: 0, stopCount: 0 };

  it('gives each seat its stop and the detour of its metres', () => {
    // 3 plazas a 300 m: 3 × (2 + 2)
    expect(
      detourBudgetMin({ ...onRoute, offeredSeats: 3, maxDetourM: 300 }),
    ).toBe(12);
    expect(
      detourBudgetMin({ ...onRoute, offeredSeats: 1, maxDetourM: 150 }),
    ).toBe(3);
    expect(
      detourBudgetMin({ ...onRoute, offeredSeats: 2, maxDetourM: 500 }),
    ).toBe(10);
    // Sin metros (o unos desconocidos), los de por defecto
    expect(
      detourBudgetMin({ ...onRoute, offeredSeats: 1, maxDetourM: null }),
    ).toBe(4);
    expect(
      detourBudgetMin({ ...onRoute, offeredSeats: 1, maxDetourM: 999 }),
    ).toBe(4);
  });

  it('counts what the stops add to the route and 2 min each', () => {
    expect(
      detourBudgetMin({
        isStops: true,
        offeredSeats: 3,
        maxDetourM: null,
        routeDetourMin: 3.4,
        stopCount: 2,
      }),
    ).toBe(7);
  });
});

describe('trip timing', () => {
  const ARRIVAL = new Date('2026-11-12T08:00:00Z');

  // Llega a esa hora como muy tarde aunque recoja a alguien
  it('leaves early enough for the route and the maximum detour', () => {
    expect(departureForArrival(ARRIVAL, 25, 10)).toEqual(
      new Date('2026-11-12T07:25:00Z'),
    );
  });

  it('uses the departure when it is given', () => {
    const departureAt = new Date('2026-11-12T07:30:00Z');

    expect(resolveDeparture({ departureAt }, 25, 10)).toBe(departureAt);
  });

  it('computes the departure from the arrival', () => {
    expect(resolveDeparture({ arrivalAt: ARRIVAL }, 20, 5)).toEqual(
      new Date('2026-11-12T07:35:00Z'),
    );
  });

  // PublishTripDto ya lo impide: sería un fallo del código
  it('fails without a departure or an arrival', () => {
    expect(() => resolveDeparture({}, 20, 5)).toThrow(
      'A trip needs departureAt or arrivalAt',
    );
  });
});
