import type { Point } from 'typeorm';
import { StopNotInTripError } from './errors/stop-not-in-trip.error';
import { planStopPickups } from './stop-pickups';

function point(lon: number): Point {
  return { type: 'Point', coordinates: [lon, 36.83] };
}

describe('planStopPickups', () => {
  // La ruta por las paradas dura 20 min; la directa, 15
  const route = { durationMin: 20, directDurationMin: 15 };
  const stops = [
    { id: 'near-campus', position: 1, etaOffsetMin: 12 },
    { id: 'first', position: 0, etaOffsetMin: 5 },
  ];

  it('orders the pickups by stop and adds the time of each stop with someone', () => {
    const plan = planStopPickups({
      tripId: 't1',
      stops,
      route,
      points: [
        { id: 'r2', location: point(-2.42), stopId: 'near-campus' },
        { id: 'r1', location: point(-2.45), stopId: 'first' },
      ],
    });

    expect(plan.pickups).toEqual([
      expect.objectContaining({
        requestId: 'r1',
        stopId: 'first',
        position: 0,
        etaOffsetMin: 5,
      }),
      expect.objectContaining({
        requestId: 'r2',
        stopId: 'near-campus',
        position: 1,
        etaOffsetMin: 12 + 2,
      }),
    ]);
    // 5 min de las paradas en la ruta y 2 por cada parada con alguien
    expect(plan.usedDetourMin).toBe(5 + 2 * 2);
  });

  it('counts a stop once however many board there', () => {
    const plan = planStopPickups({
      tripId: 't1',
      stops,
      route,
      points: [
        { id: 'r1', location: point(-2.45), stopId: 'first' },
        { id: 'r2', location: point(-2.45), stopId: 'first' },
      ],
    });

    expect(plan.usedDetourMin).toBe(5 + 2);
    expect(plan.pickups.map(({ etaOffsetMin }) => etaOffsetMin)).toEqual([
      5, 5,
    ]);
  });

  it('only spends the stops on the route while nobody boards', () => {
    expect(planStopPickups({ tripId: 't1', stops, route, points: [] })).toEqual(
      { pickups: [], usedDetourMin: 5 },
    );
  });

  it('refuses a pickup outside the stops of the trip', () => {
    expect(() =>
      planStopPickups({
        tripId: 't1',
        stops,
        route,
        points: [{ id: 'r1', location: point(-2.45), stopId: 'elsewhere' }],
      }),
    ).toThrow(StopNotInTripError);
  });
});
