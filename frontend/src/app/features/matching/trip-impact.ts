// Estimación de lo que se ahorra al compartir un trayecto en vez de ir en el
// coche propio. Valores de ejemplo (DATOS DE EJEMPLO, ver
// pendientes-memoria.md): la distancia por carretera se aproxima con la línea
// recta por un factor, y el CO₂ y la gasolina con medias de un coche normal.
// Cuando haya rutas reales (OSRM) y métricas del Gemelo Digital, se sustituye

// Lo que se alarga la carretera frente a la línea recta
const ROAD_FACTOR = 1.3;
// kg de CO₂ por km de un turismo medio
const CO2_KG_PER_KM = 0.12;
// € de gasolina por km (6 L/100 km a 1,60 €/L)
const FUEL_EUROS_PER_KM = 0.1;
const EARTH_RADIUS_KM = 6371;
// Velocidad media por ciudad y carretera de la zona, y el redondeo de la
// duración (como el selector de hora)
const AVERAGE_SPEED_KMH = 40;
const DURATION_STEP_MIN = 5;

export interface TripImpact {
  km: number;
  co2Kg: number;
  fuelEuros: number;
}

// Entre dos puntos GeoJSON ([longitud, latitud]); null si están en el mismo
// sitio (no hay nada que ahorrar)
export function estimateTripImpact(
  from: readonly [number, number],
  to: readonly [number, number],
): TripImpact | null {
  const km = distanceKm(from, to) * ROAD_FACTOR;
  if (km < 0.5) {
    return null;
  }
  return {
    km: Math.round(km),
    co2Kg: Math.round(km * CO2_KG_PER_KM * 10) / 10,
    fuelEuros: Math.round(km * FUEL_EUROS_PER_KM * 10) / 10,
  };
}

// Minutos aproximados del trayecto, sin desvíos, redondeados hacia arriba a
// los 5 minutos (al menos 5)
export function estimateDurationMin(
  from: readonly [number, number],
  to: readonly [number, number],
): number {
  const minutes = ((distanceKm(from, to) * ROAD_FACTOR) / AVERAGE_SPEED_KMH) * 60;
  return Math.max(DURATION_STEP_MIN, Math.ceil(minutes / DURATION_STEP_MIN) * DURATION_STEP_MIN);
}

// Distancia en línea recta, en km (fórmula del haversine)
export function distanceKm(
  [fromLng, fromLat]: readonly [number, number],
  [toLng, toLat]: readonly [number, number],
): number {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const dLat = toRadians(toLat - fromLat);
  const dLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}
