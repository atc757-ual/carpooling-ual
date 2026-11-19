import {
  TravelPreferences,
  EMPTY_TRAVEL_PREFERENCES,
} from '../../../core/models/travel-preferences.model';
import { TripResult } from '../../../core/models/trip-result.model';

// Filtros manuales de los resultados por las preferencias del conductor:
// solo filtran la lista en el cliente;
// la puntuación del matching no cambia, para no bajar la cobertura ni alterar
// la evaluación. Una preferencia sin indicar (null) no pasa ningún filtro
export const PREFERENCE_FILTERS = ['no_smoking', 'pets', 'music', 'chatty', 'quiet'] as const;
export type PreferenceFilter = (typeof PREFERENCE_FILTERS)[number];

const PASSES: Readonly<Record<PreferenceFilter, (preferences: TravelPreferences) => boolean>> = {
  no_smoking: ({ smoking }) => smoking === 'no',
  pets: ({ pets }) => pets === 'small_carrier' || pets === 'pet_friendly',
  music: ({ music }) => music === 'any' || music === 'soft',
  // «Depende» vale para los dos: el conductor se adapta
  chatty: ({ conversation }) => conversation === 'chatty' || conversation === 'depends',
  quiet: ({ conversation }) => conversation === 'quiet' || conversation === 'depends',
};

export function driverPreferencesOf(trip: TripResult): TravelPreferences {
  return trip.driver.preferences ?? EMPTY_TRAVEL_PREFERENCES;
}

// Los viajes que pasan todos los filtros elegidos (sin filtros, todos)
export function filterByPreferences(
  trips: readonly TripResult[],
  filters: ReadonlySet<PreferenceFilter>,
): TripResult[] {
  if (filters.size === 0) {
    return [...trips];
  }
  return trips.filter((trip) =>
    [...filters].every((filter) => PASSES[filter](driverPreferencesOf(trip))),
  );
}

// El valor flexible de cada preferencia: encaja con cualquier otro
const FLEXIBLE: Partial<Record<keyof TravelPreferences, string>> = {
  conversation: 'depends',
  music: 'any',
};

// «Coincide con tus preferencias»: cada preferencia que el pasajero indicó en
// su perfil encaja con la del conductor (la misma, o una de las dos es la
// flexible: «Depende» en la charla, «Cualquiera» en la música). Si el
// conductor no la indicó, no encaja; las que el pasajero no indicó no cuentan.
// Sin ninguna indicada por el pasajero, no hay etiqueta
export function matchesPreferences(
  passenger: TravelPreferences | undefined,
  driver: TravelPreferences,
): boolean {
  if (!passenger) {
    return false;
  }
  const keys = (Object.keys(passenger) as (keyof TravelPreferences)[]).filter(
    (key) => passenger[key] !== null,
  );
  return (
    keys.length > 0 &&
    keys.every((key) => {
      const mine = passenger[key];
      const theirs = driver[key];
      if (theirs === null) {
        return false;
      }
      const flexible = FLEXIBLE[key];
      return mine === theirs || mine === flexible || theirs === flexible;
    })
  );
}
