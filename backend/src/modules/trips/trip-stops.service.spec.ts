import type { LineString, Point, Repository } from 'typeorm';
import type { CampusParkingsService } from '../places/campus-parkings.service';
import type { TripStop } from './entities/trip-stop.entity';
import { InvalidStopsError } from './errors/invalid-stops.error';
import { StopsExceedDetourError } from './errors/stops-exceed-detour.error';
import type { TripRoutesService } from './trip-routes.service';
import { TripStopsService } from './trip-stops.service';

function point(lon: number): Point {
  return { type: 'Point', coordinates: [lon, 36.83] };
}

const ORIGIN = point(-2.46);
const CAMPUS = point(-2.41);
const LINE: LineString = {
  type: 'LineString',
  coordinates: [ORIGIN.coordinates, CAMPUS.coordinates],
};
const DIRECT = {
  distanceKm: 5,
  durationMin: 12,
  geometry: LINE,
  source: 'osrm',
};

describe('TripStopsService', () => {
  const plan = jest.fn();
  const planVia = jest.fn();
  const isNearAny = jest.fn();
  const service = new TripStopsService(
    {} as Repository<TripStop>,
    { plan, planVia } as unknown as TripRoutesService,
    { isNearAny } as unknown as CampusParkingsService,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    plan.mockResolvedValue(DIRECT);
    isNearAny.mockResolvedValue(true);
  });

  it('orders the stops along the route and gives each its minutes', async () => {
    planVia.mockResolvedValue({
      route: { ...DIRECT, durationMin: 15 },
      legsMin: [3.4, 4.2, 7.4],
    });

    const published = await service.planRoute({
      origin: ORIGIN,
      destination: CAMPUS,
      pickupMode: 'stops',
      stops: [
        { name: 'Second', location: point(-2.43) },
        { name: 'First', location: point(-2.45) },
      ],
    });

    expect(planVia).toHaveBeenCalledWith(
      ORIGIN,
      [point(-2.45), point(-2.43)],
      CAMPUS,
    );
    expect(published.direct).toBe(DIRECT);
    expect(published.routeDetourMin).toBe(3);
    expect(published.stops).toEqual([
      { name: 'First', location: point(-2.45), position: 0, etaOffsetMin: 3 },
      { name: 'Second', location: point(-2.43), position: 1, etaOffsetMin: 8 },
    ]);
  });

  it('refuses stops that do not fit the mode, the campus or the detour', async () => {
    const stops = [{ name: 'Stop', location: point(-2.44) }];
    const trip = { origin: ORIGIN, destination: CAMPUS, stops };

    await expect(service.planRoute(trip)).rejects.toThrow(InvalidStopsError);
    await expect(
      service.planRoute({ ...trip, pickupMode: 'stops', maxDetourM: 500 }),
    ).rejects.toThrow(InvalidStopsError);
    isNearAny.mockResolvedValue(false);
    await expect(
      service.planRoute({ ...trip, pickupMode: 'stops' }),
    ).rejects.toThrow(InvalidStopsError);
    isNearAny.mockResolvedValue(true);
    planVia.mockResolvedValue({
      route: { ...DIRECT, durationMin: 25 },
      legsMin: [10, 15],
    });
    await expect(
      service.planRoute({ ...trip, pickupMode: 'stops' }),
    ).rejects.toThrow(StopsExceedDetourError);
  });

  it('keeps the direct route when picking up on the route', async () => {
    await expect(
      service.planRoute({ origin: ORIGIN, destination: CAMPUS }),
    ).resolves.toEqual({
      route: DIRECT,
      direct: DIRECT,
      routeDetourMin: 0,
      stops: [],
    });
    expect(planVia).not.toHaveBeenCalled();
  });

  describe('assertChangesFit', () => {
    const trip = { pickupMode: 'stops' as const };

    it('lets a trip on the route change freely', () => {
      expect(() =>
        service.assertChangesFit(
          { pickupMode: 'on_route' },
          { origin: ORIGIN, maxDetourM: 300 },
        ),
      ).not.toThrow();
    });

    it('does not move a trip with stops nor give it metres', () => {
      expect(() =>
        service.assertChangesFit(trip, { destination: CAMPUS }),
      ).toThrow(InvalidStopsError);
      expect(() => service.assertChangesFit(trip, { maxDetourM: 500 })).toThrow(
        InvalidStopsError,
      );
    });
  });
});
