import type { LineString, Point } from 'typeorm';
import {
  fitsBudget,
  orderPickups,
  pickupOffsets,
  stopCount,
  usedDetourMin,
} from './pickup-plan';

function point(lon: number, lat: number): Point {
  return { type: 'Point', coordinates: [lon, lat] };
}

// Del centro de Almería al campus, en línea recta hacia el este
const ORIGIN = point(-2.4637, 36.8381);
const ROUTE: LineString = {
  type: 'LineString',
  coordinates: [
    [-2.4637, 36.8381],
    [-2.435, 36.834],
    [-2.4058, 36.8297],
  ],
};

describe('pickup plan', () => {
  it('orders the pickups along the route, whatever the order they came in', () => {
    const near = { id: 'near', location: point(-2.455, 36.837) };
    const middle = { id: 'middle', location: point(-2.435, 36.8345) };
    const far = { id: 'far', location: point(-2.41, 36.8302) };

    const ordered = orderPickups(ROUTE, [far, near, middle]);

    expect(ordered.map(({ id }) => id)).toEqual(['near', 'middle', 'far']);
  });

  it('counts the time spent on detours and stops against the direct route', () => {
    expect(
      usedDetourMin({ durationMin: 21, directDurationMin: 11, stops: 2 }),
    ).toBe(14);
  });

  it('never gives a negative detour (a shorter road route than the direct estimate)', () => {
    expect(
      usedDetourMin({ durationMin: 10, directDurationMin: 11, stops: 0 }),
    ).toBe(0);
  });

  it('does not count a pickup at the driver departure point as a stop', () => {
    const atOrigin = { id: 'a', location: point(-2.46371, 36.83811) };
    const onTheWay = { id: 'b', location: point(-2.435, 36.834) };

    expect(stopCount(ORIGIN, [atOrigin, onTheWay])).toBe(1);
    expect(stopCount(ORIGIN, [atOrigin])).toBe(0);
  });

  it('adds the stop time of every earlier pickup to the next pickup time', () => {
    expect(pickupOffsets([3, 4])).toEqual([3, 9]);
    expect(pickupOffsets([3, 4, 5])).toEqual([3, 9, 16]);
  });

  it('adds no stop time after a pickup at the departure point', () => {
    expect(pickupOffsets([0, 4])).toEqual([0, 4]);
  });

  it('fits the budget up to its last minute', () => {
    expect(fitsBudget(10, 10)).toBe(true);
    expect(fitsBudget(10.5, 10)).toBe(false);
  });
});
