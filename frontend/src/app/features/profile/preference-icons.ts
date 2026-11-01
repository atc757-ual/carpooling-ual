import { chatbubblesOutline, flameOutline, musicalNotesOutline, pawOutline } from 'ionicons/icons';
import { TravelPreferences } from '../../core/models/travel-preferences.model';

// Icono de cada preferencia de viaje, en la tarjeta del Perfil y en su modal
export const PREFERENCE_ICONS: Readonly<Record<keyof TravelPreferences, string>> = {
  conversation: chatbubblesOutline,
  music: musicalNotesOutline,
  smoking: flameOutline,
  pets: pawOutline,
};

export { timeOutline as TIME_TOLERANCE_ICON } from 'ionicons/icons';
