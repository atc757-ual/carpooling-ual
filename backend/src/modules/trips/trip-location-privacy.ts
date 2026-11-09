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

// El centro de la celda de la cuadrícula en que cae el punto (GeoJSON:
// [longitud, latitud])
export function approximatePoint(point: Point): Point {
  const [lon, lat] = point.coordinates;
  return { type: 'Point', coordinates: [snapToGrid(lon), snapToGrid(lat)] };
}
