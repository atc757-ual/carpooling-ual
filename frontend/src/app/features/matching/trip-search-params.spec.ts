import { Params } from '@angular/router';
import { TripSearch } from '../../core/models/trip-search.model';
import { parseSearchParams, toSearchParams } from './trip-search-params';

const SEARCH: TripSearch = {
  place: 'Roquetas de Mar',
  entrance: 'north',
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

// Así llegan de la URL: todo como texto
const PARAMS: Params = {
  place: 'Roquetas de Mar',
  entrance: 'north',
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: '20',
  seats: '1',
};

describe('toSearchParams', () => {
  it('puts the search in the URL, with the place trimmed', () => {
    expect(toSearchParams({ ...SEARCH, place: '  Roquetas de Mar ' })).toEqual({
      ...SEARCH,
      place: 'Roquetas de Mar',
    });
  });
});

describe('parseSearchParams', () => {
  it('reads the search from the URL', () => {
    expect(parseSearchParams(PARAMS)).toEqual(SEARCH);
  });

  it('reads a trip back from the campus', () => {
    expect(parseSearchParams({ ...PARAMS, direction: 'from-campus', entrance: 'east' })).toEqual({
      ...SEARCH,
      direction: 'from-campus',
      entrance: 'east',
    });
  });

  it('gives nothing without a search', () => {
    expect(parseSearchParams({})).toBeNull();
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
    ['margin', '15'],
    ['margin', 'veinte'],
    ['seats', '0'],
    ['seats', '5'],
    ['seats', '1.5'],
  ])('gives nothing when %s is %s', (name, value) => {
    expect(parseSearchParams({ ...PARAMS, [name]: value })).toBeNull();
  });

  it.each(['place', 'entrance', 'direction', 'date', 'time', 'margin', 'seats'])(
    'gives nothing without %s',
    (name) => {
      const params = Object.fromEntries(Object.entries(PARAMS).filter(([key]) => key !== name));

      expect(parseSearchParams(params)).toBeNull();
    },
  );
});
