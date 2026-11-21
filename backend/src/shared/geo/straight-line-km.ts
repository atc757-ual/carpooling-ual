const EARTH_RADIUS_KM = 6371;

// Distancia del círculo máximo (fórmula del semiverseno) entre dos puntos
// [longitud, latitud], en km. Pura: la usan la estimación de rutas de los
// viajes y el recorrido del gemelo del viaje
export function straightLineKm(from: number[], to: number[]): number {
  const [fromLon, fromLat] = from.map(toRadians);
  const [toLon, toLat] = to.map(toRadians);
  const a =
    Math.sin((toLat - fromLat) / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin((toLon - fromLon) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
