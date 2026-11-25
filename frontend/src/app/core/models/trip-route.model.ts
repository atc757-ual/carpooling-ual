import { TripStatus } from './driver.model';

// Ruta vial devuelta por GET /trips/:id/route (GeoJSON usa [longitud, latitud])
export interface TripRoute {
  tripId: string;
  // La ruta actual, con las recogidas aceptadas
  distanceKm: number;
  // La directa, sin recogidas: con ella se estima el CO₂ ahorrado. Solo en la
  // ruta de un viaje publicado (no en la planificada al publicar)
  directDistanceKm?: number;
  durationMin: number;
  // Sin trazado (null) para quien no tiene plaza: señalaría dónde empieza o
  // acaba el conductor
  geometry: { type: 'LineString'; coordinates: [number, number][] } | null;
  source: 'osrm' | 'estimated';
  tripStatus: TripStatus;
  startedAt: string | null;
  estimatedArrivalAt: string | null;
}
