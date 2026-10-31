// Catálogo cerrado de avatares de la plataforma (tabla avatars). Sin fotos
// subidas por el usuario (RGPD, sin moderación externa)
export const AVATAR_KEYS = [
  'sun',
  'wave',
  'cactus',
  'palm',
  'compass',
  'car',
  'leaf',
  'book',
  'coffee',
  'headphones',
  'cat',
  'owl',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

// Preferencias de viaje del usuario: valen tanto cuando conduce como cuando va
// de pasajero
export const CONVERSATION_PREFERENCES = ['chatty', 'depends', 'quiet'] as const;
export type ConversationPreference = (typeof CONVERSATION_PREFERENCES)[number];

export const MUSIC_PREFERENCES = ['any', 'soft', 'none'] as const;
export type MusicPreference = (typeof MUSIC_PREFERENCES)[number];

export const SMOKING_PREFERENCES = ['no', 'stops_only', 'allowed'] as const;
export type SmokingPreference = (typeof SMOKING_PREFERENCES)[number];

export const PETS_PREFERENCES = [
  'none',
  'small_carrier',
  'pet_friendly',
] as const;
export type PetsPreference = (typeof PETS_PREFERENCES)[number];

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
