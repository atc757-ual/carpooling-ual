import type { EntityManager, LineString, Point, Repository } from 'typeorm';
import { TripPickup } from './entities/trip-pickup.entity';
import type { TripRoute } from './entities/trip-route.entity';
import type { Trip } from './entities/trip.entity';
import { DetourBudgetExceededError } from './errors/detour-budget-exceeded.error';
import { TripPickupsChangedError } from './errors/trip-pickups-changed.error';
import type { RoutePlan } from './route-plan';
import { TripPickupsService } from './trip-pickups.service';
import type { TripRoutesService } from './trip-routes.service';

function point(lon: number, lat: number): Point {
  return { type: 'Point', coordinates: [lon, lat] };
}

const ORIGIN = point(-2.4637, 36.8381);
const CAMPUS = point(-2.4058, 36.8297);
const NEAR = point(-2.455, 36.837);
const FAR = point(-2.42, 36.832);
const DEPARTURE = new Date('2026-11-20T07:30:00Z');
const LINE: LineString = {
  type: 'LineString',
  coordinates: [ORIGIN.coordinates, CAMPUS.coordinates],
};

const TRIP = {
  id: 't1',
  origin: ORIGIN,
  destination: CAMPUS,
  departureAt: DEPARTURE,
  maxDetourMin: 10,
} as Trip;

function routePlan(durationMin: number): RoutePlan {
  return { distanceKm: 8, durationMin, geometry: LINE, source: 'osrm' };
}

describe('TripPickupsService', () => {
  const findPickups = jest.fn();
  const findRoute = jest.fn();
  const planVia = jest.fn();
  const plan = jest.fn();
  const saveRoute = jest.fn();
  const service = new TripPickupsService(
    { find: findPickups } as unknown as Repository<TripPickup>,
    { findOneBy: findRoute } as unknown as Repository<TripRoute>,
    { planVia, plan, save: saveRoute } as unknown as TripRoutesService,
  );

  const managerFind = jest.fn();
  const managerDelete = jest.fn();
  const managerSave = jest.fn();
  const manager = {
    find: managerFind,
    delete: managerDelete,
    save: managerSave,
    create: (_entity: unknown, values: object) => values,
  } as unknown as EntityManager;

  beforeEach(() => {
    jest.resetAllMocks();
    findRoute.mockResolvedValue({
      tripId: 't1',
      durationMin: 11,
      directDurationMin: 11,
      geometry: LINE,
    });
  });

  it('plans the route through a new pickup and gives its time', async () => {
    findPickups.mockResolvedValue([]);
    planVia.mockResolvedValue({ route: routePlan(15), legsMin: [3, 12] });

    const planned = await service.planWith(
      TRIP,
      { id: 'r1', location: NEAR },
      null,
    );

    expect(planVia).toHaveBeenCalledWith(ORIGIN, [NEAR], CAMPUS);
    expect(planned.pickups).toEqual([
      { requestId: 'r1', location: NEAR, position: 0, etaOffsetMin: 3 },
    ]);
    // 15 − 11 de desvío + 2 de parada
    expect(planned.usedDetourMin).toBe(6);
    expect(planned.previousRequestIds).toEqual([]);
  });

  it('keeps the earlier pickups and orders them along the route', async () => {
    findPickups.mockResolvedValue([
      { requestId: 'r1', location: FAR, position: 0, etaOffsetMin: 9 },
    ]);
    planVia.mockResolvedValue({ route: routePlan(16), legsMin: [3, 6, 5] });

    const planned = await service.planWith(
      TRIP,
      { id: 'r2', location: NEAR },
      null,
    );

    expect(planVia).toHaveBeenCalledWith(ORIGIN, [NEAR, FAR], CAMPUS);
    expect(planned.pickups.map(({ requestId }) => requestId)).toEqual([
      'r2',
      'r1',
    ]);
    // r2 a los 3 min; r1 tras 3 + 2 de parada + 6
    expect(planned.pickups.map(({ etaOffsetMin }) => etaOffsetMin)).toEqual([
      3, 11,
    ]);
    expect(planned.previousRequestIds).toEqual(['r1']);
  });

  it('goes back to the direct route without pickups', async () => {
    findPickups.mockResolvedValue([
      { requestId: 'r1', location: NEAR, position: 0, etaOffsetMin: 3 },
    ]);
    plan.mockResolvedValue(routePlan(11));

    const planned = await service.planWith(TRIP, null, 'r1');

    expect(plan).toHaveBeenCalledWith(ORIGIN, CAMPUS);
    expect(planned.pickups).toEqual([]);
    expect(planned.usedDetourMin).toBe(0);
  });

  it('saves the pickups and the route, and gives each pickup time', async () => {
    managerFind.mockResolvedValue([]);
    findPickups.mockResolvedValue([]);
    planVia.mockResolvedValue({ route: routePlan(15), legsMin: [3, 12] });
    const planned = await service.planWith(
      TRIP,
      { id: 'r1', location: NEAR },
      null,
    );

    const times = await service.apply(manager, TRIP, planned);

    expect(managerDelete).toHaveBeenCalledWith(TripPickup, { tripId: 't1' });
    expect(managerSave).toHaveBeenCalledWith([
      expect.objectContaining({ tripId: 't1', requestId: 'r1', position: 0 }),
    ]);
    expect(saveRoute).toHaveBeenCalledWith(manager, 't1', routePlan(15), 11);
    expect(times.get('r1')).toEqual(new Date('2026-11-20T07:33:00Z'));
  });

  it('refuses a plan made before another pickup was saved', async () => {
    findPickups.mockResolvedValue([]);
    planVia.mockResolvedValue({ route: routePlan(15), legsMin: [3, 12] });
    const planned = await service.planWith(
      TRIP,
      { id: 'r2', location: NEAR },
      null,
    );
    managerFind.mockResolvedValue([{ requestId: 'r1' }]);

    await expect(service.apply(manager, TRIP, planned)).rejects.toBeInstanceOf(
      TripPickupsChangedError,
    );
    expect(managerSave).not.toHaveBeenCalled();
  });

  it('refuses a new pickup that does not fit in the detour budget', async () => {
    findPickups.mockResolvedValue([]);
    managerFind.mockResolvedValue([]);
    // 21 − 11 + 2 = 12 > 10
    planVia.mockResolvedValue({ route: routePlan(21), legsMin: [8, 13] });
    const planned = await service.planWith(
      TRIP,
      { id: 'r1', location: FAR },
      null,
    );

    await expect(service.apply(manager, TRIP, planned)).rejects.toBeInstanceOf(
      DetourBudgetExceededError,
    );
  });

  it('removes a pickup without checking the budget (it only gives time back)', async () => {
    findPickups.mockResolvedValue([
      { requestId: 'r1', location: FAR, position: 0, etaOffsetMin: 8 },
    ]);
    managerFind.mockResolvedValue([{ requestId: 'r1' }]);
    plan.mockResolvedValue(routePlan(30));

    const planned = await service.planWith(TRIP, null, 'r1');

    await expect(service.apply(manager, TRIP, planned)).resolves.toBeInstanceOf(
      Map,
    );
  });
});
