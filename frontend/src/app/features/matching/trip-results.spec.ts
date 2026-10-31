import { TripMatch } from '../../core/models/trip-match.model';
import { TripSearch } from '../../core/models/trip-search.model';
import { PARKING_P1, ROQUETAS } from './trip-search.testing';
import {
  formatShortDate,
  formatTime,
  minutesBetween,
  toSearchRequest,
  toTripDetail,
  toTripResult,
} from './trip-results';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 2,
};

const MATCH: TripMatch = {
  id: 't1',
  driver: { id: 'd1', name: 'Lucía Cortés' },
  departureAt: new Date('2026-10-27T07:40:00').toISOString(),
  arrivalAt: new Date('2026-10-27T08:12:00').toISOString(),
  availableSeats: 1,
  detourMin: 4,
  timeDifferenceMin: 12,
  score: 0.7,
  vehicle: { brand: 'Seat', model: 'Ibiza', color: 'white' },
};

describe('trip results', () => {
  it('sends the search with the local date and time as an instant', () => {
    expect(toSearchRequest(SEARCH)).toEqual({
      place: { type: 'Point', coordinates: ROQUETAS.coordinates },
      parkingId: 'p1',
      direction: 'to-campus',
      desiredAt: new Date('2026-10-27T08:00:00').toISOString(),
      marginMin: 20,
      seats: 2,
    });
  });

  it('turns a trip of the API into a result row', () => {
    expect(toTripResult(MATCH, SEARCH)).toEqual({
      id: 't1',
      departureTime: '07:40',
      arrivalTime: '08:12',
      origin: 'Roquetas de Mar',
      destination: 'Campus UAL · Parking P1',
      driver: { name: 'Lucía Cortés', isEmailVerified: true },
      freeSeats: 1,
      pickupDetourMinutes: 4,
      vehicle: MATCH.vehicle,
    });
  });

  it('puts the campus first when coming back', () => {
    const result = toTripResult(MATCH, { ...SEARCH, direction: 'from-campus' });

    expect([result.origin, result.destination]).toEqual([
      'Campus UAL · Parking P1',
      'Roquetas de Mar',
    ]);
  });

  it('builds the detail with the stops and the trip length', () => {
    const detail = toTripDetail(toTripResult(MATCH, SEARCH), SEARCH);

    expect(detail).toMatchObject({
      origin: 'Roquetas de Mar',
      originDetail: ROQUETAS.locality,
      destination: 'Campus UAL',
      destinationDetail: 'Parking P1',
      date: '2026-10-27',
      tripMinutes: 32,
    });
    expect(detail.vehicle).toEqual(MATCH.vehicle);
  });

  it('counts minutes and formats times', () => {
    expect(minutesBetween('23:50', '00:10')).toBe(20);
    expect(formatTime(new Date('2026-10-27T09:05:00').toISOString())).toBe('09:05');
  });
});

describe('formatShortDate', () => {
  it('reads a day in local time', () => {
    expect(formatShortDate('2026-10-27')).toBe('27 oct');
  });
});
