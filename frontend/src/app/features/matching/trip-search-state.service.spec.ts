import { TestBed } from '@angular/core/testing';
import { TripSearch } from '../../core/models/trip-search.model';
import { PARKING_P1, ROQUETAS } from './trip-search.testing';
import { TripSearchStateService } from './trip-search-state.service';

const STORAGE_KEY = 'matching.trip-search';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  date: '2026-10-27',
  time: '08:00',
  margin: 20,
  seats: 1,
};

describe('TripSearchStateService', () => {
  const create = (): TripSearchStateService => TestBed.inject(TripSearchStateService);

  beforeEach(() => sessionStorage.clear());

  it('starts without a search', () => {
    expect(create().search()).toBeNull();
  });

  it('keeps the search and stores it for a reload', () => {
    const state = create();

    state.set(SEARCH);

    expect(state.search()).toEqual(SEARCH);
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual(SEARCH);
  });

  it('gets the stored search back after a reload', () => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(SEARCH));

    expect(create().search()).toEqual(SEARCH);
  });

  it.each(['{', JSON.stringify({ ...SEARCH, seats: 9 })])(
    'ignores a stored search that is not valid (%s)',
    (stored) => {
      sessionStorage.setItem(STORAGE_KEY, stored);

      expect(create().search()).toBeNull();
    },
  );

  it('clears the search for a new one', () => {
    const state = create();
    state.set(SEARCH);

    state.clear();

    expect(state.search()).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
