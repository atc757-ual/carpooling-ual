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

const CONVERSATION_LABELS: Readonly<Record<ConversationPreference, string>> = {
  chatty: 'Me gusta charlar',
  depends: 'Según el día',
  quiet: 'Prefiero ir tranquilo',
};

const MUSIC_LABELS: Readonly<Record<MusicPreference, string>> = {
  any: 'Con música',
  soft: 'Música suave',
  none: 'Sin música',
};

const SMOKING_LABELS: Readonly<Record<SmokingPreference, string>> = {
  no: 'No se fuma en el coche',
  stops_only: 'Solo en paradas',
  allowed: 'Se permite fumar',
};

const PETS_LABELS: Readonly<Record<PetsPreference, string>> = {
  none: 'Sin mascotas',
  small_carrier: 'Pequeñas en transportín',
  pet_friendly: 'Pet friendly',
};

// Textos visibles de las preferencias elegidas; vacío si no tiene ninguna
export interface FormattedPreferenceItem {
  criterion: string;
  value: string;
}

export function formatTravelPreferencesStructured(
  preferences: TravelPreferences | null | undefined,
): FormattedPreferenceItem[] {
  if (!preferences) {
    return [];
  }
  const items: FormattedPreferenceItem[] = [];
  if (preferences.conversation) {
    items.push({ criterion: 'Conversación', value: CONVERSATION_LABELS[preferences.conversation] });
  }
  if (preferences.music) {
    items.push({ criterion: 'Música', value: MUSIC_LABELS[preferences.music] });
  }
  if (preferences.smoking) {
    items.push({ criterion: 'Fumar', value: SMOKING_LABELS[preferences.smoking] });
  }
  if (preferences.pets) {
    items.push({ criterion: 'Mascotas', value: PETS_LABELS[preferences.pets] });
  }
  return items;
}

export function formatTravelPreferences(
  preferences: TravelPreferences | null | undefined,
): string[] {
  if (!preferences) {
    return [];
  }
  const labels: string[] = [];
  if (preferences.conversation) {
    labels.push(CONVERSATION_LABELS[preferences.conversation]);
  }
  if (preferences.music) {
    labels.push(MUSIC_LABELS[preferences.music]);
  }
  if (preferences.smoking) {
    labels.push(SMOKING_LABELS[preferences.smoking]);
  }
  if (preferences.pets) {
    labels.push(PETS_LABELS[preferences.pets]);
  }
  return labels;
}
