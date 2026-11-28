import type { Point } from 'typeorm';
import { approximateCoordinates } from '../../shared/geo/approximate-coordinates';

// La cuadrícula es común (shared/geo): los extremos del viaje para quien no
// tiene plaza y la copia del gemelo para la simulación se redondean igual
export { APPROXIMATE_GRID_DEGREES } from '../../shared/geo/approximate-coordinates';

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
  return {
    type: 'Point',
    coordinates: approximateCoordinates(point.coordinates),
  };
}
