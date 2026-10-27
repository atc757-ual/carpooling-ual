import { TripSearch } from '../../core/models/trip-search.model';
import { PARKING_P1, ROQUETAS } from './trip-search.testing';
import { getExampleTrip, getExampleTripDetail } from './example-trips';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
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
    expect(trip.destination).toBe('Campus UAL · Parking P1');
    expect([trip.departureTime, trip.arrivalTime]).toEqual(['07:40', '08:12']);
  });

  it('leaves the campus a little after the time when coming back', () => {
    const trip = getExampleTrip({ ...SEARCH, direction: 'from-campus', time: '14:00' });

    expect(trip.origin).toBe('Campus UAL · Parking P1');
    expect(trip.destination).toBe('Roquetas de Mar');
    expect([trip.departureTime, trip.arrivalTime]).toEqual(['14:08', '14:40']);
  });
});

describe('getExampleTripDetail', () => {
  it('is the same trip as in the results, with each stop and its detail', () => {
    const detail = getExampleTripDetail('example-1', SEARCH);

    expect(detail).toMatchObject({
      id: 'example-1',
      date: '2026-10-27',
      departureTime: '07:40',
      arrivalTime: '08:12',
      origin: 'Roquetas de Mar',
      originDetail: 'Recogida',
      destination: 'Campus UAL',
      destinationDetail: 'Parking P1',
    });
  });

  it('goes from the campus parking to the place when coming back', () => {
    const detail = getExampleTripDetail('example-1', { ...SEARCH, direction: 'from-campus' });

    expect(detail).toMatchObject({
      origin: 'Campus UAL',
      originDetail: 'Parking P1',
      destination: 'Roquetas de Mar',
      destinationDetail: 'Llegada',
    });
  });

  it('has no trip without a search or with another id', () => {
    expect(getExampleTripDetail('example-1', null)).toBeNull();
    expect(getExampleTripDetail('example-2', SEARCH)).toBeNull();
  });
});
