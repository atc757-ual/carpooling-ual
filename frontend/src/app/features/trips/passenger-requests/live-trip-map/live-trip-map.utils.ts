const EARTH_RADIUS_METERS = 6_371_000;
export const TOGETHER_DISTANCE_METERS = 30;
// Pendiente: sustituir por la ETA de ruta cuando el backend la devuelva al punto.
// Esta estimación aproximada usa línea recta a 30 km/h, no la ruta de carretera.
const METERS_PER_MINUTE_AT_ESTIMATED_SPEED = 500;

// Distancia geodésica para saber si el pasajero ya está en el coche y estimar
// el tiempo a su punto de recogida sin transmitir su ubicación.
export function distanceMeters(first: [number, number], second: [number, number]): number {
  const radians = Math.PI / 180;
  const firstLongitude = first[0] * radians;
  const firstLatitude = first[1] * radians;
  const secondLongitude = second[0] * radians;
  const secondLatitude = second[1] * radians;
  const latitudeDelta = secondLatitude - firstLatitude;
  const longitudeDelta = secondLongitude - firstLongitude;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function estimatePickupMinutes(car: [number, number], pickup: [number, number]): number {
  return Math.max(
    1,
    Math.round(distanceMeters(car, pickup) / METERS_PER_MINUTE_AT_ESTIMATED_SPEED),
  );
}

export function areTogether(car: [number, number], passenger: [number, number]): boolean {
  return distanceMeters(car, passenger) <= TOGETHER_DISTANCE_METERS;
}

export function shouldRenderPassengerMarker(
  car: [number, number] | null,
  passenger: [number, number] | null,
): boolean {
  return passenger !== null && (car === null || !areTogether(car, passenger));
}

// «en unos 3 min»; con 1 minuto o menos, null (quien llama dice «Está
// llegando»). Sin «~», que se lee como un signo menos
export function inAbout(minutes: number): string | null {
  const rounded = Math.round(minutes);
  return rounded <= 1 ? null : `en unos ${rounded} min`;
}

// Corto, para la línea de la tarjeta «En directo»: «unos 3 min» o «llegando»
export function shortEta(minutes: number): string {
  const rounded = Math.round(minutes);
  return rounded <= 1 ? 'llegando' : `unos ${rounded} min`;
}

export function interpolateLatLng(
  from: [number, number],
  to: [number, number],
  progress: number,
): [number, number] {
  const amount = Math.min(1, Math.max(0, progress));
  return [from[0] + (to[0] - from[0]) * amount, from[1] + (to[1] - from[1]) * amount];
}
