import type { Point } from 'typeorm';

// El CO₂ que se dejó de emitir al compartir coche. Los mismos valores de
// ejemplo que la app (frontend: matching/trip-impact.ts) y DATOS DE EJEMPLO
// (pendientes-memoria.md): la carretera se aproxima con la línea recta por
// un factor, y el CO₂ con la media de un turismo. Se sustituye cuando haya
// métricas del Gemelo Digital

// Lo que se alarga la carretera frente a la línea recta
const ROAD_FACTOR = 1.3;
// kg de CO₂ por km de un turismo medio
const CO2_KG_PER_KM = 0.12;
// Por debajo, el origen y el destino son el mismo sitio: nada que ahorrar
const MIN_KM = 0.5;
const EARTH_RADIUS_KM = 6371;

export interface ImpactLeg {
  origin: Point;
  destination: Point;
  carsAvoided: number;
}

// Distancia en línea recta entre dos puntos GeoJSON, en km (haversine)
export function straightLineKm(from: Point, to: Point): number {
  const [fromLng, fromLat] = from.coordinates;
  const [toLng, toLat] = to.coordinates;
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) *
      Math.cos(toRadians(toLat)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

// Los km por carretera de un trayecto (0 si el origen y el destino son el
// mismo sitio)
function roadKm({ origin, destination }: ImpactLeg): number {
  const km = straightLineKm(origin, destination) * ROAD_FACTOR;
  return km < MIN_KM ? 0 : km;
}

// El CO₂ de un coche en ese trayecto, redondeado a 0,1 kg como en la app
function tripCo2Kg(leg: ImpactLeg): number {
  return Math.round(roadKm(leg) * CO2_KG_PER_KM * 10) / 10;
}

// Los km compartidos: los de los trayectos en que se compartió coche (como
// conductor, con algún pasajero), redondeados a 0,1 km
export function sharedKm(legs: readonly ImpactLeg[]): number {
  const total = legs.reduce(
    (sum, leg) => sum + (leg.carsAvoided > 0 ? roadKm(leg) : 0),
    0,
  );
  return Math.round(total * 10) / 10;
}

// Lo ahorrado en todos los trayectos: el de un coche por cada coche evitado
export function savedCo2Kg(legs: readonly ImpactLeg[]): number {
  const total = legs.reduce(
    (sum, leg) => sum + tripCo2Kg(leg) * leg.carsAvoided,
    0,
  );
  return Math.round(total * 10) / 10;
}
