// Preferencias de viaje (como conductor y como pasajero) y margen horario por
// defecto de las búsquedas (ver backend/src/modules/users/travel-preferences.ts)

export const CONVERSATION_PREFERENCES = ['chatty', 'depends', 'quiet'] as const;
export type ConversationPreference = (typeof CONVERSATION_PREFERENCES)[number];

export const MUSIC_PREFERENCES = ['any', 'soft', 'none'] as const;
export type MusicPreference = (typeof MUSIC_PREFERENCES)[number];

export const SMOKING_PREFERENCES = ['no', 'stops_only', 'allowed'] as const;
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

export interface TravelPreferenceOption<T extends string> {
  value: T;
  label: string;
}

export interface TravelPreferenceGroup<
  K extends keyof TravelPreferences = keyof TravelPreferences,
> {
  key: K;
  title: string;
  options: readonly TravelPreferenceOption<NonNullable<TravelPreferences[K]>>[];
}

export const CONVERSATION_OPTIONS: readonly TravelPreferenceOption<ConversationPreference>[] = [
  { value: 'chatty', label: 'Me gusta charlar' },
  { value: 'depends', label: 'Según el día' },
  { value: 'quiet', label: 'Prefiero ir tranquilo' },
];

export const MUSIC_OPTIONS: readonly TravelPreferenceOption<MusicPreference>[] = [
  { value: 'any', label: 'Con música' },
  { value: 'soft', label: 'Música suave' },
  { value: 'none', label: 'Sin música' },
];

export const SMOKING_OPTIONS: readonly TravelPreferenceOption<SmokingPreference>[] = [
  { value: 'no', label: 'No se fuma en el coche' },
  { value: 'stops_only', label: 'Solo en paradas' },
  { value: 'allowed', label: 'Se permite fumar' },
];

export const PETS_OPTIONS: readonly TravelPreferenceOption<PetsPreference>[] = [
  { value: 'none', label: 'Sin mascotas' },
  { value: 'small_carrier', label: 'Pequeñas en transportín' },
  { value: 'pet_friendly', label: 'Pet friendly' },
];

export const TRAVEL_PREFERENCE_GROUPS: readonly [
  TravelPreferenceGroup<'conversation'>,
  TravelPreferenceGroup<'music'>,
  TravelPreferenceGroup<'smoking'>,
  TravelPreferenceGroup<'pets'>,
] = [
  { key: 'conversation', title: 'Conversación', options: CONVERSATION_OPTIONS },
  { key: 'music', title: 'Música', options: MUSIC_OPTIONS },
  { key: 'smoking', title: 'Fumar', options: SMOKING_OPTIONS },
  { key: 'pets', title: 'Mascotas', options: PETS_OPTIONS },
];

// Textos de las preferencias elegidas, en el orden de los grupos; vacío si no
// tiene ninguna
export function formatTravelPreferences(
  preferences: TravelPreferences | null | undefined,
): string[] {
  return TRAVEL_PREFERENCE_GROUPS.flatMap(({ key, options }) => {
    const value = preferences?.[key];
    const option = (options as readonly TravelPreferenceOption<string>[]).find(
      (candidate) => candidate.value === value,
    );
    return option ? [option.label] : [];
  });
}
