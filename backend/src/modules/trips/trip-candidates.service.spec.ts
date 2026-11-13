import type { DataSource } from 'typeorm';
import type { CandidateQuery } from '../matching/candidate-source';
import {
  CAMPUS_RADIUS_M,
  CANDIDATE_PICKUP_ID,
  MAX_CANDIDATES,
  PICKUP_RADIUS_M,
  TripCandidatesService,
} from './trip-candidates.service';
import type { TripPickupsService } from './trip-pickups.service';
import type { TripRoutesService } from './trip-routes.service';
import { WALK_RADIUS_M } from './trip-timing';

const QUERY: CandidateQuery = {
  passengerId: 'passenger-1',
  place: { type: 'Point', coordinates: [-2.6, 36.76] },
  campus: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  direction: 'to-campus',
  departureFrom: new Date('2026-10-28T06:00:00Z'),
  departureTo: new Date('2026-10-28T08:30:00Z'),
  seats: 1,
};
const ROW = {
  id: 't1',
  driver_id: 'd1',
  vehicle_id: 'v1',
  departure_at: new Date('2026-10-28T07:40:00Z'),
  offered_seats: 3,
  available_seats: 2,
  driver_trip_count: 12,
  max_detour_min: 10,
  duration_min: 25,
  direct_duration_min: 22,
  origin: { type: 'Point', coordinates: [-2.61, 36.75] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  distance_km: 0.4567,
  pickup_mode: 'on_route',
  stop_id: null,
  stop_name: null,
  stop_location: null,
  stop_distance_m: null,
};

describe('TripCandidatesService', () => {
  const query = jest.fn();
  const planDurationVia = jest.fn();
  const planWith = jest.fn();
  const service = new TripCandidatesService(
    { query } as unknown as DataSource,
    { planDurationVia } as unknown as TripRoutesService,
    { planWith } as unknown as TripPickupsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('filters in PostGIS with parameters and adds the detour', async () => {
    query.mockResolvedValue([ROW]);
    planWith.mockResolvedValue({
      usedDetourMin: 4,
      pickups: [{ requestId: CANDIDATE_PICKUP_ID, etaOffsetMin: 7 }],
    });

    const [candidate] = await service.findCandidates(QUERY);

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    // Hacia el campus, el radio es el que el conductor eligió (max_detour_m)
    expect(sql).toContain('COALESCE(t.max_detour_m');
    expect(params).toEqual([
      -2.6,
      36.76,
      -2.4045,
      36.8322,
      'passenger-1',
      1,
      QUERY.departureFrom,
      QUERY.departureTo,
      true,
      CAMPUS_RADIUS_M,
      PICKUP_RADIUS_M,
      MAX_CANDIDATES,
      WALK_RADIUS_M,
    ]);
    // El desvío de todo el viaje con las recogidas ya aceptadas y esta
    expect(planWith).toHaveBeenCalledWith(
      {
        id: 't1',
        origin: ROW.origin,
        destination: ROW.destination,
        departureAt: ROW.departure_at,
        maxDetourMin: 10,
        pickupMode: 'on_route',
      },
      { id: CANDIDATE_PICKUP_ID, location: QUERY.place },
      null,
    );
    expect(planDurationVia).not.toHaveBeenCalled();
    expect(candidate.pickupAt).toEqual(new Date('2026-10-28T07:47:00Z'));
    // La llegada es la directa más el desvío total (sin contar dos veces
    // el de las recogidas ya aceptadas, que va en la ruta actual)
    expect(candidate.durationMin).toBe(ROW.direct_duration_min);
    expect(candidate).toMatchObject({
      tripId: 't1',
      driverId: 'd1',
      vehicleId: 'v1',
      offeredSeats: 3,
      driverTripCount: 12,
      durationMin: 22,
      detourMin: 4,
      distanceKm: 0.46,
      stop: null,
    });
  });

  it('picks up at the nearest stop of a trip with stops', async () => {
    const stopLocation = { type: 'Point', coordinates: [-2.598, 36.761] };
    query.mockResolvedValue([
      {
        ...ROW,
        pickup_mode: 'stops',
        stop_id: 's1',
        stop_name: 'Av. Cabo de Gata',
        stop_location: stopLocation,
        stop_distance_m: 240,
      },
    ]);
    planWith.mockResolvedValue({
      usedDetourMin: 6,
      pickups: [{ requestId: CANDIDATE_PICKUP_ID, etaOffsetMin: 9 }],
    });

    const [candidate] = await service.findCandidates(QUERY);

    const [sql] = query.mock.calls[0] as [string];
    expect(sql).toContain('trip_stops');
    expect(planWith).toHaveBeenCalledWith(
      expect.objectContaining({ pickupMode: 'stops' }),
      { id: CANDIDATE_PICKUP_ID, location: stopLocation, stopId: 's1' },
      null,
    );
    expect(candidate).toMatchObject({
      detourMin: 6,
      pickupAt: new Date('2026-10-28T07:49:00Z'),
      stop: {
        id: 's1',
        name: 'Av. Cabo de Gata',
        location: stopLocation,
        walkingDistanceM: 240,
      },
    });
  });

  it('never gives a negative detour and checks the origin when leaving', async () => {
    query.mockResolvedValue([ROW]);
    planDurationVia.mockResolvedValue(20);

    const [candidate] = await service.findCandidates({
      ...QUERY,
      direction: 'from-campus',
    });

    const [, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params[8]).toBe(false);
    expect(candidate.detourMin).toBe(0);
    // Al volver todos suben en el campus: sin recogidas ni hora estimada
    expect(planWith).not.toHaveBeenCalled();
    expect(candidate.pickupAt).toBeNull();
  });
});
