import { TripSearch } from '../../core/models/trip-search.model';
import { PARKING_P1, PARKING_P3, ROQUETAS } from './trip-search.testing';
import { parseTripSearch } from './trip-search';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

describe('parseTripSearch', () => {
  it('reads a stored search, leaving out unknown fields', () => {
    expect(parseTripSearch({ ...SEARCH, place: { ...ROQUETAS, extra: 1 }, other: 2 })).toEqual(
      SEARCH,
    );
  });

  it('reads a trip back from the campus', () => {
    const search: TripSearch = { ...SEARCH, direction: 'from-campus', parking: PARKING_P3 };

    expect(parseTripSearch(search)).toEqual(search);
  });

  it.each([null, undefined, 'Roquetas', 42, []])('gives nothing for %s', (value) => {
    expect(parseTripSearch(value)).toBeNull();
  });

  it.each([
    ['place', 'Roquetas de Mar'],
    ['place', { ...ROQUETAS, name: '   ' }],
    ['place', { ...ROQUETAS, coordinates: [200, 36] }],
    ['place', { ...ROQUETAS, coordinates: [-2.6] }],
    ['place', { ...ROQUETAS, name: 'a'.repeat(121) }],
    ['parking', 'p1'],
    ['parking', { id: 'p1' }],
    ['direction', 'around'],
    ['date', '27/10/2026'],
    ['date', '2026-02-30'],
    ['time', '8:00'],
    ['time', '24:00'],
    ['margin', 15],
    ['margin', '20'],
    ['seats', 0],
    ['seats', 5],
    ['seats', 1.5],
  ])('gives nothing when %s is %s', (name, value) => {
    expect(parseTripSearch({ ...SEARCH, [name]: value })).toBeNull();
  });

  it.each(['place', 'parking', 'direction', 'date', 'time', 'margin', 'seats'])(
    'gives nothing without %s',
    (name) => {
      const search = Object.fromEntries(Object.entries(SEARCH).filter(([key]) => key !== name));

      expect(parseTripSearch(search)).toBeNull();
    },
  );
});
