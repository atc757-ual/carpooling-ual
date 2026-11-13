import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';
import { LateCancellationsService } from './late-cancellations.service';
import { TripViewerAccessService } from './trip-viewer-access.service';
import { PlanRouteDto } from './dto/plan-route.dto';
import { RoutePlan } from './route-plan';

describe('TripsController', () => {
  let controller: TripsController;
  let tripsService: jest.Mocked<Partial<TripsService>>;
  let lateCancellations: jest.Mocked<Partial<LateCancellationsService>>;
  let viewerAccess: jest.Mocked<Partial<TripViewerAccessService>>;

  beforeEach(() => {
    tripsService = {
      planRoute: jest.fn(),
      publish: jest.fn(),
      getById: jest.fn(),
      start: jest.fn(),
      finish: jest.fn(),
      listByDriver: jest.fn(),
    };
    lateCancellations = {
      getDriverStatus: jest.fn(),
    };
    viewerAccess = {
      forViewer: jest.fn(),
    };

    controller = new TripsController(
      tripsService as unknown as TripsService,
      lateCancellations as unknown as LateCancellationsService,
      viewerAccess as unknown as TripViewerAccessService,
    );
  });

  describe('planRoute', () => {
    it('plans a route between origin and destination and returns PlannedRouteResource', async () => {
      const dto: PlanRouteDto = {
        origin: { type: 'Point', coordinates: [-2.4637, 36.8381] },
        destination: { type: 'Point', coordinates: [-2.4058, 36.8297] },
      };
      const plan: RoutePlan = {
        distanceKm: 7.76,
        durationMin: 11,
        geometry: {
          type: 'LineString',
          coordinates: [
            [-2.4637, 36.8381],
            [-2.4058, 36.8297],
          ],
        },
        source: 'osrm',
      };

      (tripsService.planRoute as jest.Mock).mockResolvedValue(plan);

      const result = await controller.planRoute(dto);

      expect(tripsService.planRoute).toHaveBeenCalledWith(
        dto.origin,
        dto.destination,
      );
      expect(result).toEqual({
        distanceKm: 7.76,
        durationMin: 11,
        geometry: plan.geometry,
        source: 'osrm',
      });
    });
  });
});
