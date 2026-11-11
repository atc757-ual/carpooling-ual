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

// El número de portal al final del nombre: «, 29», «, 29B» o «, s/n»
const STREET_NUMBER = /,\s*(?:\d+\s*[a-z]?|s\/n)\s*$/i;

// El nombre de un extremo del viaje sin el número de portal, para quien no
// tiene plaza: «Calle Profesor Mulian, 29» → «Calle Profesor Mulian». Los
// nombres sin número (un edificio, un barrio) quedan igual
export function withoutStreetNumber(name: string | null): string | null {
  if (name === null) {
    return null;
  }
  const street = name.replace(STREET_NUMBER, '').trim();
  return street === '' ? name : street;
}

// El centro de la celda de la cuadrícula en que cae el punto (GeoJSON:
// [longitud, latitud])
export function approximatePoint(point: Point): Point {
  const [lon, lat] = point.coordinates;
  return { type: 'Point', coordinates: [snapToGrid(lon), snapToGrid(lat)] };
}
