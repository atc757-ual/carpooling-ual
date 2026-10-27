import { TripSearch } from '../../core/models/trip-search.model';
import { parseTripSearch } from './trip-search';

const SEARCH: TripSearch = {
  place: 'Roquetas de Mar',
  entrance: 'north',
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

describe('parseTripSearch', () => {
  it('reads a stored search, with the place trimmed', () => {
    expect(parseTripSearch({ ...SEARCH, place: '  Roquetas de Mar ' })).toEqual(SEARCH);
  });

  it('reads a trip back from the campus', () => {
    const search: TripSearch = { ...SEARCH, direction: 'from-campus', entrance: 'east' };

    expect(parseTripSearch(search)).toEqual(search);
  });

  it.each([null, undefined, 'Roquetas', 42, []])('gives nothing for %s', (value) => {
    expect(parseTripSearch(value)).toBeNull();
  });

  it.each([
    ['place', '   '],
    ['place', 'a'.repeat(121)],
    ['entrance', 'west'],
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

  it.each(['place', 'entrance', 'direction', 'date', 'time', 'margin', 'seats'])(
    'gives nothing without %s',
    (name) => {
      const search = Object.fromEntries(Object.entries(SEARCH).filter(([key]) => key !== name));

      expect(parseTripSearch(search)).toBeNull();
    },
  );
});
