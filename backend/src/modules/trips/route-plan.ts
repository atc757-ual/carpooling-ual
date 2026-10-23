import type { LineString, Point } from 'typeorm';
import type { RouteSource } from './entities/trip-route.entity';

// Una ruta calculada, antes de guardarla con su viaje
export interface RoutePlan {
  distanceKm: number;
  durationMin: number;
  geometry: LineString;
  source: RouteSource;
}

const EARTH_RADIUS_KM = 6371;
// Plan B del análisis de riesgos (cap. 13): la carretera nunca va en línea
// recta; 1,3 es un factor de rodeo habitual en ciudad e interurbano
const DETOUR_FACTOR = 1.3;
// Velocidad media supuesta para la duración estimada
const AVERAGE_SPEED_KMH = 50;

// Ruta estimada si OSRM no responde: la distancia en línea recta por el
// factor de rodeo, a una velocidad media fija, y como geometría el segmento
// entre el origen y el destino. Es una aproximación, por eso va marcada
export function estimateRoute(origin: Point, destination: Point): RoutePlan {
  const distanceKm =
    straightLineKm(origin.coordinates, destination.coordinates) * DETOUR_FACTOR;
  return {
    distanceKm: roundTo2(distanceKm),
    durationMin: Math.max(1, Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60)),
    geometry: {
      type: 'LineString',
      coordinates: [origin.coordinates, destination.coordinates],
    },
    source: 'estimated',
  };
}

// Distancia del círculo máximo (fórmula del semiverseno) entre dos puntos
// [longitud, latitud]
export function straightLineKm(from: number[], to: number[]): number {
  const [fromLon, fromLat] = from.map(toRadians);
  const [toLon, toLat] = to.map(toRadians);
  const a =
    Math.sin((toLat - fromLat) / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin((toLon - fromLon) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
