import {
  EMPTY_TRAVEL_PREFERENCES,
  TravelPreferences,
} from '../../../core/models/travel-preferences.model';
import { TripResult } from '../../../core/models/trip-result.model';
import {
  driverPreferencesOf,
  filterByPreferences,
  matchesPreferences,
  PreferenceFilter,
} from './preference-filter';

function trip(id: string, preferences?: Partial<TravelPreferences>): TripResult {
  return {
    id,
    driver: { preferences: preferences && { ...EMPTY_TRAVEL_PREFERENCES, ...preferences } },
  } as TripResult;
}

const LUCIA = trip('lucia', {
  conversation: 'chatty',
  music: 'soft',
  smoking: 'no',
  pets: 'small_carrier',
});
const SARA = trip('sara', { conversation: 'depends', music: 'soft', smoking: 'no' });
const PABLO = trip('pablo', { conversation: 'quiet', music: 'any', smoking: 'no', pets: 'none' });
const UNKNOWN = trip('unknown');
const TRIPS = [LUCIA, SARA, PABLO, UNKNOWN];

const ids = (filters: PreferenceFilter[]): string[] =>
  filterByPreferences(TRIPS, new Set(filters)).map(({ id }) => id);

describe('preference filters', () => {
  it('keeps every trip without filters', () => {
    expect(ids([])).toEqual(['lucia', 'sara', 'pablo', 'unknown']);
  });

  it('keeps only the drivers who said so, and combines the filters', () => {
    expect(ids(['no_smoking'])).toEqual(['lucia', 'sara', 'pablo']);
    expect(ids(['pets'])).toEqual(['lucia']);
    expect(ids(['music'])).toEqual(['lucia', 'sara', 'pablo']);
    // «Depende» vale para los dos
    expect(ids(['chatty'])).toEqual(['lucia', 'sara']);
    expect(ids(['quiet'])).toEqual(['sara', 'pablo']);
    expect(ids(['pets', 'quiet'])).toEqual([]);
  });

  it('reads a driver without preferences as all unknown', () => {
    expect(driverPreferencesOf(UNKNOWN)).toEqual(EMPTY_TRAVEL_PREFERENCES);
  });

  it('matches when each preference the passenger gave fits the driver', () => {
    const mario: TravelPreferences = {
      conversation: 'quiet',
      music: 'any',
      smoking: 'no',
      pets: 'none',
    };
    expect(matchesPreferences(mario, driverPreferencesOf(PABLO))).toBe(true);
    // Charla distinta
    expect(matchesPreferences(mario, driverPreferencesOf(LUCIA))).toBe(false);
    // Sara no indicó las mascotas
    expect(matchesPreferences(mario, driverPreferencesOf(SARA))).toBe(false);
    // «Depende» y «Cualquiera» encajan con todo
    expect(
      matchesPreferences(
        { ...EMPTY_TRAVEL_PREFERENCES, conversation: 'depends', music: 'soft' },
        driverPreferencesOf(PABLO),
      ),
    ).toBe(true);
  });

  it('gives no match without passenger preferences', () => {
    expect(matchesPreferences(undefined, driverPreferencesOf(PABLO))).toBe(false);
    expect(matchesPreferences(EMPTY_TRAVEL_PREFERENCES, driverPreferencesOf(PABLO))).toBe(false);
  });
});
