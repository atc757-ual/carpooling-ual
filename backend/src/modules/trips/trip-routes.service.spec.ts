import type { Point, Repository } from 'typeorm';
import type { TripRoute } from './entities/trip-route.entity';
import { OsrmUnavailableError, type OsrmClient } from './osrm.client';
import { estimateRoute } from './route-plan';
import { TripRoutesService } from './trip-routes.service';

const ORIGIN: Point = { type: 'Point', coordinates: [-2.61, 36.75] };
const STOP: Point = { type: 'Point', coordinates: [-2.6, 36.76] };
const CAMPUS: Point = { type: 'Point', coordinates: [-2.4045, 36.8322] };

describe('TripRoutesService.planDurationVia', () => {
  const route = jest.fn();
  const service = new TripRoutesService(
    {} as Repository<TripRoute>,
    { route } as unknown as OsrmClient,
  );

  beforeEach(() => jest.clearAllMocks());

  it('asks OSRM for the route through the stop', async () => {
    route.mockResolvedValue({ durationMin: 31 });

    expect(await service.planDurationVia(ORIGIN, STOP, CAMPUS)).toBe(31);
    expect(route).toHaveBeenCalledWith(ORIGIN, CAMPUS, [STOP]);
  });

  it('adds both estimated legs when OSRM is down', async () => {
    route.mockRejectedValue(new OsrmUnavailableError('timeout'));

    expect(await service.planDurationVia(ORIGIN, STOP, CAMPUS)).toBe(
      estimateRoute(ORIGIN, STOP).durationMin +
        estimateRoute(STOP, CAMPUS).durationMin,
    );
  });
});

describe('TripRoutesService.getForTrip', () => {
  const NOW = new Date('2026-11-08T10:00:00.000Z');
  const TRIP = { id: 't1', origin: ORIGIN, destination: CAMPUS };
  const OSRM_PLAN = {
    distanceKm: 18.4,
    durationMin: 21,
    geometry: {
      type: 'LineString' as const,
      coordinates: [ORIGIN.coordinates, STOP.coordinates, CAMPUS.coordinates],
    },
    source: 'osrm' as const,
  };
  const route = jest.fn();
  const findOneBy = jest.fn();
  const findOneByOrFail = jest.fn();
  const upsert = jest.fn();
  const service = new TripRoutesService(
    { findOneBy, findOneByOrFail, upsert } as unknown as Repository<TripRoute>,
    { route } as unknown as OsrmClient,
  );

  // Una ruta guardada hace unos minutos
  function savedRoute(source: 'osrm' | 'estimated', minutesAgo: number) {
    return {
      tripId: 't1',
      ...estimateRoute(ORIGIN, CAMPUS),
      source,
      updatedAt: new Date(NOW.getTime() - minutesAgo * 60_000),
    } as TripRoute;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    findOneByOrFail.mockResolvedValue({ tripId: 't1', ...OSRM_PLAN });
  });

  it('returns a road route as it is, without asking OSRM', async () => {
    const saved = savedRoute('osrm', 600);
    findOneBy.mockResolvedValue(saved);

    expect(await service.getForTrip(TRIP, NOW)).toBe(saved);
    expect(route).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('keeps a recent estimate without asking OSRM again', async () => {
    const saved = savedRoute('estimated', 4);
    findOneBy.mockResolvedValue(saved);

    expect(await service.getForTrip(TRIP, NOW)).toBe(saved);
    expect(route).not.toHaveBeenCalled();
  });

  it('replaces an old estimate with the road route', async () => {
    findOneBy.mockResolvedValue(savedRoute('estimated', 5));
    route.mockResolvedValue(OSRM_PLAN);

    const result = await service.getForTrip(TRIP, NOW);

    expect(route).toHaveBeenCalledWith(ORIGIN, CAMPUS);
    expect(upsert).toHaveBeenCalledWith(
      {
        tripId: 't1',
        ...OSRM_PLAN,
        directDurationMin: OSRM_PLAN.durationMin,
      },
      ['tripId'],
    );
    expect(result.source).toBe('osrm');
  });

  it('calculates a missing route, estimated if OSRM is down', async () => {
    findOneBy.mockResolvedValue(null);
    route.mockRejectedValue(new OsrmUnavailableError('timeout'));

    await service.getForTrip(TRIP, NOW);

    const estimate = estimateRoute(ORIGIN, CAMPUS);
    expect(upsert).toHaveBeenCalledWith(
      { tripId: 't1', ...estimate, directDurationMin: estimate.durationMin },
      ['tripId'],
    );
  });
});
