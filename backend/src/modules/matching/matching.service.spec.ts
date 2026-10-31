import type { CampusParkingsService } from '../places/campus-parkings.service';
import type { UsersService } from '../users/users.service';
import type { VehiclesService } from '../users/vehicles.service';
import type { CandidateQuery, TripCandidate } from './candidate-source';
import { SearchTripsDto } from './dto/search-trips.dto';
import { MatchingService } from './matching.service';

const PARKING_LOCATION = {
  type: 'Point' as const,
  coordinates: [-2.4045, 36.8322],
};
const SEARCH: SearchTripsDto = {
  place: { type: 'Point', coordinates: [-2.6, 36.76] },
  parkingId: 'p1',
  direction: 'to-campus',
  desiredAt: new Date('2026-10-28T08:10:00Z'),
};
// Llega a las 08:10 (07:40 + 25 min + 5 de desvío)
const CANDIDATE: TripCandidate = {
  tripId: 't1',
  driverId: 'd1',
  vehicleId: 'v1',
  departureAt: new Date('2026-10-28T07:40:00Z'),
  durationMin: 25,
  detourMin: 5,
  maxDetourMin: 10,
  availableSeats: 2,
  origin: { type: 'Point', coordinates: [-2.61, 36.75] },
  destination: PARKING_LOCATION,
  distanceKm: 0.4,
};

describe('MatchingService', () => {
  const findCandidates = jest.fn();
  const getActive = jest.fn();
  const getNames = jest.fn();
  const getRecognitionDetails = jest.fn();
  const service = new MatchingService(
    { findCandidates },
    { getActive } as unknown as CampusParkingsService,
    { getNames } as unknown as UsersService,
    { getRecognitionDetails } as unknown as VehiclesService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    getActive.mockResolvedValue({ id: 'p1', location: PARKING_LOCATION });
    getNames.mockResolvedValue(new Map([['d1', 'Lucía Cortés']]));
    getRecognitionDetails.mockResolvedValue(
      new Map([['v1', { brand: 'Seat', model: 'Ibiza', color: 'blue' }]]),
    );
  });

  it('asks for departures up to 2 h before the arrival when going to campus', async () => {
    findCandidates.mockResolvedValue([CANDIDATE]);

    const [result] = await service.search('passenger-1', SEARCH);

    expect(findCandidates).toHaveBeenCalledWith({
      passengerId: 'passenger-1',
      place: SEARCH.place,
      campus: PARKING_LOCATION,
      direction: 'to-campus',
      departureFrom: new Date('2026-10-28T05:50:00Z'),
      departureTo: new Date('2026-10-28T08:30:00Z'),
      seats: 1,
    });
    expect(result.driverName).toBe('Lucía Cortés');
    expect(result.vehicle).toEqual({
      brand: 'Seat',
      model: 'Ibiza',
      color: 'blue',
    });
    expect(result.match).toMatchObject({ score: 0.7, timeDifferenceMin: 0 });
  });

  it('compares the departure when leaving the campus', async () => {
    findCandidates.mockResolvedValue([CANDIDATE]);

    const results = await service.search('passenger-1', {
      ...SEARCH,
      direction: 'from-campus',
      desiredAt: new Date('2026-10-28T07:40:00Z'),
      marginMin: 10,
      seats: 2,
    });

    const [query] = findCandidates.mock.calls[0] as [CandidateQuery];
    expect(query).toMatchObject({
      departureFrom: new Date('2026-10-28T07:30:00Z'),
      departureTo: new Date('2026-10-28T07:50:00Z'),
      seats: 2,
    });
    expect(results).toHaveLength(1);
  });

  it('drops the candidates that do not fit', async () => {
    findCandidates.mockResolvedValue([{ ...CANDIDATE, detourMin: 15 }]);

    expect(await service.search('passenger-1', SEARCH)).toEqual([]);
    expect(getNames).toHaveBeenCalledWith([]);
    expect(getRecognitionDetails).toHaveBeenCalledWith([]);
  });
});
