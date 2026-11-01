import { GeoPoint } from './place.model';

// Última ubicación del conductor (GET /trips/{id}/position)
export interface TripPosition {
  tripId: string;
  position: GeoPoint;
  recordedAt: string;
  remainingKm: number;
  remainingMin: number;
  remainingSource: 'osrm' | 'estimated';
  estimatedArrivalAt: string;
}
