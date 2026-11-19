import { homeOutline, schoolOutline } from 'ionicons/icons';
import { isCampusName } from '../matching/campus';
import { withLazyLabels } from '../../core/i18n/lazy-labels';

export interface TripWay {
  label: string;
  icon: string;
}

export const TO_CAMPUS: TripWay = withLazyLabels(
  { icon: schoolOutline },
  { label: 'screens.tripWay.toCampus' },
);
export const FROM_CAMPUS: TripWay = withLazyLabels(
  { icon: homeOutline },
  { label: 'screens.tripWay.fromCampus' },
);

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
