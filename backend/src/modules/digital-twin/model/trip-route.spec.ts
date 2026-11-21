import { MAX_TRACK_POINTS, TripRoute } from './trip-route';
import type { TwinPoint } from './twin-event';

function point(lng: number, lat: number): TwinPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

const ORIGIN = point(-2.6, 36.75);
const CAMPUS = point(-2.4048, 36.8295);

describe('TripRoute', () => {
  let route: TripRoute;

  beforeEach(() => {
    route = new TripRoute();
  });

  it('takes the planned route from the trip: origin, destination and stops in order', () => {
    route.applyPlan({
      origin: ORIGIN,
      destination: CAMPUS,
      stops: [
        {
          id: 's2',
          position: 2,
          name: 'Plaza',
          location: point(-2.5, 36.8),
          etaOffsetMin: 9,
        },
        {
          id: 's1',
          position: 1,
          name: 'Rotonda',
          location: point(-2.55, 36.77),
          etaOffsetMin: 4,
        },
      ],
    });

    expect(route.origin).toEqual(ORIGIN);
    expect(route.destination).toEqual(CAMPUS);
    expect(route.stops.map(({ id, order }) => [id, order])).toEqual([
      ['s1', 1],
      ['s2', 2],
    ]);
    expect(route.stops[0]).toEqual({
      id: 's1',
      order: 1,
      name: 'Rotonda',
      point: point(-2.55, 36.77),
      etaOffsetMin: 4,
    });
  });

  it('ignores stops it cannot read and a payload without them', () => {
    route.applyPlan({ stops: [null, 'x', { position: 1 }, { id: 's1' }] });
    expect(route.stops).toEqual([
      { id: 's1', order: 0, name: null, point: null, etaOffsetMin: null },
    ]);

    route.applyPlan({ origin: 'nowhere' });
    expect(route.origin).toBeNull();
    expect(route.stops).toEqual([]);
  });

  it('adds the positions, skips repeated ones and sums the km travelled', () => {
    route.addPosition(point(0, 0));
    route.addPosition(point(0, 0));
    route.addPosition(point(0, 1));
    route.addPosition(null);

    expect(route.track).toEqual([point(0, 0), point(0, 1)]);
    expect(route.trackPoints).toBe(2);
    // Un grado de latitud: unos 111,19 km
    expect(route.travelledKm).toBeCloseTo(111.19, 1);
  });

  it('keeps only the last positions but counts the km of the whole trip', () => {
    for (let i = 0; i <= MAX_TRACK_POINTS; i += 1) {
      route.addPosition(point(0, i / 1000));
    }

    expect(route.track).toHaveLength(MAX_TRACK_POINTS);
    expect(route.track[0]).toEqual(point(0, 1 / 1000));
    expect(route.trackPoints).toBe(MAX_TRACK_POINTS + 1);
    expect(route.travelledKm).toBeCloseTo(80.06, 1);
  });

  it('forgets the origin and the track but keeps the summary', () => {
    route.applyPlan({ origin: ORIGIN, destination: CAMPUS, stops: [] });
    route.addPosition(point(0, 0));
    route.addPosition(point(0, 1));

    route.forget();

    expect(route.origin).toBeNull();
    expect(route.track).toEqual([]);
    expect(route.destination).toEqual(CAMPUS);
    expect(route.trackPoints).toBe(2);
    expect(route.travelledKm).toBeCloseTo(111.19, 1);
  });
});
