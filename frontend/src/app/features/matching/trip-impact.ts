// Estimación de lo que se ahorra al compartir un trayecto en vez de ir en el
// coche propio, como MÁXIMO (un coche menos por pasajero; quien viene en bus
// o andando no deja un coche en casa). Método del MITECO: km × factor de
// emisión por km. La distancia por carretera se aproxima con la línea recta
// por un factor (sin ruta aún). Solo km y CO₂: es una plataforma
// colaborativa, sin enfoque económico. Las fuentes, en pendientes-memoria.md
// («Sustento del CO₂ ahorrado»). Los mismos valores que la API
// (metrics/saved-co2.ts), que con el viaje ya hecho usa los km de su ruta
// directa de OSRM. En pantalla se dice que es una estimación y su fuente
// (app-co2-source)

import { appLocale } from '../../core/i18n/app-locale';

// Lo que se alarga la carretera frente a la línea recta
const ROAD_FACTOR = 1.3;
// kg de CO₂e por km de un turismo (M1) de gasóleo en 2025: el factor oficial
// más bajo de los turismos de combustión, para no exagerar el ahorro (con
// gasolina, 0,183). Fuente: MITECO, calculadora de huella de carbono de
// organización, versión V32 (07/05/2026), pestaña «10. Factores de
// emisión», «Opción A.2: distancia recorrida (km)»
const CO2_KG_PER_KM = 0.159;
const EARTH_RADIUS_KM = 6371;
// Velocidad media por ciudad y carretera de la zona, y el redondeo de la
// duración (como el selector de hora)
const AVERAGE_SPEED_KMH = 40;
const DURATION_STEP_MIN = 5;

export interface TripImpact {
  km: number;
  co2Kg: number;
}

// Por debajo, el origen y el destino son el mismo sitio: nada que ahorrar
const MIN_KM = 0.5;

// El CO₂ de un coche en un trayecto de esos km por carretera, redondeado a
// 0,1 kg (0 si no hay trayecto). Con la ruta directa de OSRM del viaje
// (detalle del viaje) o con la aproximación de estimateTripImpact
export function co2KgForKm(km: number): number {
  return km < MIN_KM ? 0 : Math.round(km * CO2_KG_PER_KM * 10) / 10;
}

// Entre dos puntos GeoJSON ([longitud, latitud]), sin ruta aún (Buscar,
// Publicar); null si están en el mismo sitio (no hay nada que ahorrar)
export function estimateTripImpact(
  from: readonly [number, number],
  to: readonly [number, number],
): TripImpact | null {
  const km = distanceKm(from, to) * ROAD_FACTOR;
  if (km < MIN_KM) {
    return null;
  }
  return { km: Math.round(km), co2Kg: co2KgForKm(km) };
}

// «25,4 kg», «52,4 km»: la cifra en el idioma de la app y su unidad
export function formatAmount(value: number, unit: string): string {
  return `${value.toLocaleString(appLocale())} ${unit}`;
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
