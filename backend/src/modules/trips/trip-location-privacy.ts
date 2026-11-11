import type { Point } from 'typeorm';

// Lado de la cuadrícula a la que se redondea un extremo del viaje para quien
// no tiene plaza en él: 0,005° son unos 550 m de latitud y unos 440 m de
// longitud en Almería, así que el punto se mueve como mucho unos 350 m y no
// señala la casa del conductor
export const APPROXIMATE_GRID_DEGREES = 0.005;

function snapToGrid(degrees: number): number {
  const snapped =
    Math.round(degrees / APPROXIMATE_GRID_DEGREES) * APPROXIMATE_GRID_DEGREES;
  // Sin restos de coma flotante (37.840000000000003)
  return Number(snapped.toFixed(3));
}

// Lo que va tras la última coma cuando es un número de portal: «29», «29B»
// o «s/n». Anclada y sin repeticiones anidadas: tiempo lineal (sin el
// backtracking de buscar la coma y los espacios con la misma expresión)
const STREET_NUMBER = /^(?:\d{1,5} ?[a-z]?|s\/n)$/i;

// El nombre de un extremo del viaje sin el número de portal, para quien no
// tiene plaza: «Calle Profesor Mulian, 29» → «Calle Profesor Mulian». Los
// nombres sin número (un edificio, un barrio) quedan igual
export function withoutStreetNumber(name: string | null): string | null {
  if (name === null) {
    return null;
  }
  const comma = name.lastIndexOf(',');
  if (comma <= 0) {
    return name;
  }
  const tail = name.slice(comma + 1).trim();
  return STREET_NUMBER.test(tail) ? name.slice(0, comma).trim() : name;
}

// El centro de la celda de la cuadrícula en que cae el punto (GeoJSON:
// [longitud, latitud])
export function approximatePoint(point: Point): Point {
  const [lon, lat] = point.coordinates;
  return { type: 'Point', coordinates: [snapToGrid(lon), snapToGrid(lat)] };
}
