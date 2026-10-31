import { TripStatus } from './driver.model';

// Ruta vial devuelta por GET /trips/:id/route (GeoJSON usa [longitud, latitud])
export interface TripRoute {
  tripId: string;
  distanceKm: number;
  durationMin: number;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
  source: 'osrm' | 'estimated';
  tripStatus: TripStatus;
  startedAt: string | null;
  estimatedArrivalAt: string | null;
}
