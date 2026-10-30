import { TestBed } from '@angular/core/testing';
import { TripSearch } from '../../core/models/trip-search.model';
import { toIsoDate } from '../../shared/utils/date.util';
import { PARKING_P1, ROQUETAS } from './trip-search.testing';
import { TripSearchStateService } from './trip-search-state.service';

const STORAGE_KEY = 'matching.trip-search';

const SEARCH: TripSearch = {
  place: ROQUETAS,
  parking: PARKING_P1,
  direction: 'to-campus',
  // Hoy: una búsqueda de un día que ya pasó se pasa a hoy al leerla (abajo)
  date: toIsoDate(new Date()),
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

  // El campo de la fecha no admite días pasados: la búsqueda guardada ayer se
  // abre hoy (y se corrige lo guardado, para la próxima recarga)
  it('brings a search from a past day to today', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...SEARCH, date: toIsoDate(yesterday) }));

    const state = create();

    expect(state.search()?.date).toBe(toIsoDate(new Date()));
    expect(JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null').date).toBe(
      toIsoDate(new Date()),
    );
  });
});
