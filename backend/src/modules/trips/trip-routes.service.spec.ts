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
