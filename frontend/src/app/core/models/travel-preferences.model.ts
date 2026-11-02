// Preferencias de viaje (como conductor y como pasajero) y margen horario por
// defecto de las búsquedas (ver backend/src/modules/users/travel-preferences.ts)

export const CONVERSATION_PREFERENCES = ['chatty', 'depends', 'quiet'] as const;
export type ConversationPreference = (typeof CONVERSATION_PREFERENCES)[number];

export const MUSIC_PREFERENCES = ['any', 'soft', 'none'] as const;
export type MusicPreference = (typeof MUSIC_PREFERENCES)[number];

// Sin «solo en paradas»: las paradas de un viaje compartido son muy cortas
export const SMOKING_PREFERENCES = ['no', 'allowed'] as const;
export type SmokingPreference = (typeof SMOKING_PREFERENCES)[number];

export const PETS_PREFERENCES = ['none', 'small_carrier', 'pet_friendly'] as const;
export type PetsPreference = (typeof PETS_PREFERENCES)[number];

export const TIME_TOLERANCES_MIN = [5, 10, 15, 20] as const;
export type TimeToleranceMin = (typeof TIME_TOLERANCES_MIN)[number];

export interface TravelPreferences {
  conversation: ConversationPreference | null;
  music: MusicPreference | null;
  smoking: SmokingPreference | null;
  pets: PetsPreference | null;
}

export const EMPTY_TRAVEL_PREFERENCES: TravelPreferences = {
  conversation: null,
  music: null,
  smoking: null,
  pets: null,
};

export interface TravelPreferenceOption {
  value: string;
  label: string;
}

export interface TravelPreferenceGroup {
  key: keyof TravelPreferences;
  title: string;
  options: readonly TravelPreferenceOption[];
}

// Las cuatro preferencias, en orden. Sus opciones y sus textos salen del
// catálogo (TravelPreferencesStore)
export const TRAVEL_PREFERENCE_GROUPS: readonly { key: keyof TravelPreferences; title: string }[] =
  [
    { key: 'conversation', title: 'Conversación' },
    { key: 'music', title: 'Música' },
    { key: 'smoking', title: 'Fumar' },
    { key: 'pets', title: 'Mascotas' },
  ];
