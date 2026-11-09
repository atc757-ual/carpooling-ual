import { TripStatus } from './driver.model';

// Ruta vial devuelta por GET /trips/:id/route (GeoJSON usa [longitud, latitud])
export interface TripRoute {
  tripId: string;
  distanceKm: number;
  durationMin: number;
  // Sin trazado (null) para quien no tiene plaza: señalaría dónde empieza o
  // acaba el conductor
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  source: 'osrm' | 'estimated';
  tripStatus: TripStatus;
  startedAt: string | null;
  estimatedArrivalAt: string | null;
}
