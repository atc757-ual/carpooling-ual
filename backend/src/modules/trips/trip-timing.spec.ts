import { departureForArrival, resolveDeparture } from './trip-timing';

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
