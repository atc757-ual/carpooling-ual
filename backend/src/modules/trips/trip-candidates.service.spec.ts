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
    ]);
    // El desvío de todo el viaje con las recogidas ya aceptadas y esta
    expect(planWith).toHaveBeenCalledWith(
      {
        id: 't1',
        origin: ROW.origin,
        destination: ROW.destination,
        departureAt: ROW.departure_at,
        maxDetourMin: 10,
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
