import { TripSearch } from '../../../core/models/trip-search.model';
import { UsualTrip } from '../../../core/models/usual-trip.model';
import { nextUsualDate, parseUsualTrip, usualTripFromSearch, usualTripSearch } from './usual-trip';

const TRIP: UsualTrip = {
  place: { id: 'p1', name: 'Roquetas de Mar', locality: 'Roquetas', coordinates: [-2.6, 36.76] },
  parking: { id: 'P1', name: 'Parking P1' },
  weekdays: [1, 3, 5],
  arrivalTime: '08:00',
  returnTime: '14:00',
  margin: 20,
  seats: 1,
};

describe('usual trip', () => {
  // Lunes 23/11/2026
  const mondayAt = (time: string): Date => new Date(`2026-11-23T${time}:00`);

  it('searches today while there is still time, and the next of its days after', () => {
    expect(nextUsualDate([1, 3], '08:00', mondayAt('07:00'))).toBe('2026-11-23');
    expect(nextUsualDate([1, 3], '08:00', mondayAt('09:00'))).toBe('2026-11-25');
    // Solo los lunes: la semana siguiente
    expect(nextUsualDate([1], '08:00', mondayAt('09:00'))).toBe('2026-11-30');
  });

  it('builds the search there or back for the next day', () => {
    const now = mondayAt('09:00');
    expect(usualTripSearch(TRIP, 'to-campus', now)).toEqual({
      place: TRIP.place,
      parking: TRIP.parking,
      direction: 'to-campus',
      date: '2026-11-25',
      time: '08:00',
      margin: 20,
      seats: 1,
    });
    // La vuelta, a las 14:00: hoy aún da tiempo
    expect(usualTripSearch(TRIP, 'from-campus', now)).toMatchObject({
      direction: 'from-campus',
      date: '2026-11-23',
      time: '14:00',
    });
  });

  it('takes the route of a search, there or back', () => {
    const search: TripSearch = {
      place: TRIP.place,
      parking: TRIP.parking,
      direction: 'to-campus',
      date: '2026-11-25',
      time: '09:00',
      margin: 10,
      seats: 2,
    };
    expect(usualTripFromSearch(search)).toEqual({
      ...TRIP,
      weekdays: [3],
      arrivalTime: '09:00',
      returnTime: null,
      margin: 10,
      seats: 2,
    });
    expect(usualTripFromSearch({ ...search, direction: 'from-campus' })).toMatchObject({
      arrivalTime: '08:00',
      returnTime: '09:00',
    });
  });

  it('keeps only a valid stored trip', () => {
    expect(parseUsualTrip(JSON.parse(JSON.stringify(TRIP)))).toEqual(TRIP);
    expect(parseUsualTrip({ ...TRIP, weekdays: [3, 1, 3] })?.weekdays).toEqual([1, 3]);
    expect(parseUsualTrip({ ...TRIP, returnTime: null })?.returnTime).toBeNull();
    expect(parseUsualTrip(null)).toBeNull();
    expect(parseUsualTrip({ ...TRIP, weekdays: [] })).toBeNull();
    expect(parseUsualTrip({ ...TRIP, weekdays: [8] })).toBeNull();
    expect(parseUsualTrip({ ...TRIP, returnTime: '25:00' })).toBeNull();
    expect(parseUsualTrip({ ...TRIP, arrivalTime: 'ocho' })).toBeNull();
  });
});
