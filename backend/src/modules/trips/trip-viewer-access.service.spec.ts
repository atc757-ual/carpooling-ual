import type { Point } from 'typeorm';
import type { CampusParkingsService } from '../places/campus-parkings.service';
import type { Trip } from './entities/trip.entity';
import type { TripRoute } from './entities/trip-route.entity';
import {
  CAMPUS_PARKING_RADIUS_METERS,
  TripViewerAccessService,
} from './trip-viewer-access.service';
import type { TripRouteView, TripView } from './trips.service';

const point = (lon: number, lat: number): Point => ({
  type: 'Point',
  coordinates: [lon, lat],
});

const HOME = point(-2.40551, 36.83812);
const CAMPUS = point(-2.40422, 36.82898);

const TRIP = {
  id: 't1',
  driverId: 'driver',
  origin: HOME,
  originName: 'Calle Profesor Mulian, 29',
  destination: CAMPUS,
  destinationName: 'Campus UAL · Parking P1 (Sur)',
} as Trip;

const VIEW = { trip: TRIP } as TripView;
const ROUTE_VIEW = { trip: TRIP, route: {} as TripRoute } as TripRouteView;

describe('TripViewerAccessService', () => {
  const isNearAny = jest.fn((target: Point) =>
    Promise.resolve(target === CAMPUS),
  );
  let access: TripViewerAccessService;

  beforeEach(() => {
    isNearAny.mockClear();
    access = new TripViewerAccessService({
      isNearAny,
    } as unknown as CampusParkingsService);
  });

  it('shows the exact points to the driver', async () => {
    expect(await access.tripFor(VIEW, { id: 'driver' })).toBe(VIEW);
    expect(isNearAny).not.toHaveBeenCalled();
  });

  it('shows them to the participants that a module reports', async () => {
    access.onParticipantCheck((tripId, userId) =>
      Promise.resolve(tripId === 't1' && userId === 'accepted'),
    );

    expect(
      await access.canSeeExactLocation(TRIP, {
        id: 'accepted',
      }),
    ).toBe(true);
    expect(await access.canSeeExactLocation(TRIP, { id: 'other' })).toBe(false);
  });

  it('rounds the home of the driver for anyone else, but not the campus', async () => {
    const seen = await access.tripFor(VIEW, { id: 'other' });

    expect(seen.isLocationApproximate).toBe(true);
    expect(seen.trip.origin).toEqual(point(-2.405, 36.84));
    expect(seen.trip.destination).toBe(CAMPUS);
    // La calle sin el portal; el parking, tal cual
    expect(seen.trip.originName).toBe('Calle Profesor Mulian');
    expect(seen.trip.destinationName).toBe('Campus UAL · Parking P1 (Sur)');
    expect(isNearAny).toHaveBeenCalledWith(HOME, CAMPUS_PARKING_RADIUS_METERS);
  });

  it('hides the route from anyone else', async () => {
    expect(await access.routeFor(ROUTE_VIEW, { id: 'driver' })).toBe(
      ROUTE_VIEW,
    );
    expect(await access.routeFor(ROUTE_VIEW, { id: 'other' })).toEqual({
      ...ROUTE_VIEW,
      isGeometryHidden: true,
    });
  });
});
