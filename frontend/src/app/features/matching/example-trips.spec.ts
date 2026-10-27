import { TripSearch } from '../../core/models/trip-search.model';
import { getExampleTrip } from './example-trips';

const SEARCH: TripSearch = {
  place: 'Roquetas de Mar',
  entrance: 'south',
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:20',
  margin: 20,
  seats: 1,
};

describe('getExampleTrip', () => {
  it('goes from the place to the campus and arrives a little before the time', () => {
    const trip = getExampleTrip(SEARCH);

    expect(trip.origin).toBe('Roquetas de Mar');
    expect(trip.destination).toBe('Campus UAL · Ingreso sur');
    expect([trip.departureTime, trip.arrivalTime]).toEqual(['07:40', '08:12']);
  });

  it('leaves the campus a little after the time when coming back', () => {
    const trip = getExampleTrip({ ...SEARCH, direction: 'from-campus', time: '14:00' });

    expect(trip.origin).toBe('Campus UAL · Ingreso sur');
    expect(trip.destination).toBe('Roquetas de Mar');
    expect([trip.departureTime, trip.arrivalTime]).toEqual(['14:08', '14:40']);
  });
});
