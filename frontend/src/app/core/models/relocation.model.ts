import { TripMatch } from './trip-match.model';

// GET /api/requests/{id}/relocation-options: tras la cancelación del
// conductor, el viaje que encaja al 100 % (si hay) y el resto de los que
// encajan
export interface RelocationOptions {
  '@type'?: 'RelocationOptions';
  exactMatch: TripMatch | null;
  // Los demás que salen ±20 min del cancelado
  matches: TripMatch[];
  // Los demás de ese día por la misma ruta
  sameDayMatches: TripMatch[];
}
