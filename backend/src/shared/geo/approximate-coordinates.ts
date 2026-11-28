// Lado de la cuadrícula a la que se redondea un punto que no debe señalar un
// sitio exacto (p. ej. un extremo del viaje para quien no tiene plaza en él,
// o la copia del gemelo para la simulación): 0,005° son unos 550 m de latitud
// y unos 440 m de longitud en Almería, así que el punto se mueve como mucho
// unos 350 m y no señala la casa de nadie
export const APPROXIMATE_GRID_DEGREES = 0.005;

function snapToGrid(degrees: number): number {
  const snapped =
    Math.round(degrees / APPROXIMATE_GRID_DEGREES) * APPROXIMATE_GRID_DEGREES;
  // Sin restos de coma flotante (37.840000000000003)
  return Number(snapped.toFixed(3));
}

// El centro de la celda de la cuadrícula en que caen unas coordenadas
// (GeoJSON: [longitud, latitud])
export function approximateCoordinates([lon, lat]: readonly number[]): [
  number,
  number,
] {
  return [snapToGrid(lon), snapToGrid(lat)];
}
