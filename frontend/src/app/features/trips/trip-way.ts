import { homeOutline, schoolOutline } from 'ionicons/icons';
import { isCampusName } from '../matching/campus';

export interface TripWay {
  label: string;
  icon: string;
}

export const TO_CAMPUS: TripWay = { label: 'Ida al campus', icon: schoolOutline };
export const FROM_CAMPUS: TripWay = { label: 'Vuelta a casa', icon: homeOutline };

// Si un viaje es de ida (al campus) o de vuelta (desde el campus), para
// distinguirlos en Tus viajes; null si no toca el campus por ninguno de los
// dos lados (no debería pasar: todo viaje va al campus o sale de él)
export function tripWayOf(trip: {
  originName: string | null;
  destinationName: string | null;
}): TripWay | null {
  if (isCampusName(trip.destinationName)) return TO_CAMPUS;
  return isCampusName(trip.originName) ? FROM_CAMPUS : null;
}
