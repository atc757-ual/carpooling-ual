import type { Point } from 'typeorm';
import { estimateRoute, roundTo2, straightLineKm } from './route-plan';

const ALMERIA_CENTRE: Point = {
  type: 'Point',
  coordinates: [-2.4597, 36.8381],
};
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };

describe('straightLineKm', () => {
  it('measures one degree of a meridian (~111.19 km)', () => {
    expect(straightLineKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
  });

  it('is symmetric and zero between the same point', () => {
    const there = straightLineKm([-2.4597, 36.8381], [-2.4048, 36.8295]);
    const back = straightLineKm([-2.4048, 36.8295], [-2.4597, 36.8381]);

    expect(there).toBeCloseTo(back, 10);
    expect(straightLineKm([-2.4, 36.8], [-2.4, 36.8])).toBe(0);
  });
});

describe('estimateRoute (plan B when OSRM does not answer)', () => {
  it('applies the detour factor to the straight line, at 50 km/h', () => {
    const straight = straightLineKm(
      ALMERIA_CENTRE.coordinates,
      UAL_CAMPUS.coordinates,
    );

    const route = estimateRoute(ALMERIA_CENTRE, UAL_CAMPUS);

    expect(route).toEqual({
      distanceKm: roundTo2(straight * 1.3),
      durationMin: Math.round(((straight * 1.3) / 50) * 60),
      geometry: {
        type: 'LineString',
        coordinates: [ALMERIA_CENTRE.coordinates, UAL_CAMPUS.coordinates],
      },
      source: 'estimated',
    });
  });

  it('never estimates less than one minute', () => {
    expect(estimateRoute(UAL_CAMPUS, UAL_CAMPUS).durationMin).toBe(1);
  });
});
