// «1 plaza», «3 plazas»
export function formatSeats(seats: number): string {
  return seats === 1 ? '1 plaza' : `${seats} plazas`;
}

// «1 plaza libre de 1», «2 plazas libres de 3», «Sin plazas libres de 2»
export function formatAvailableSeats(available: number, offered: number): string {
  // Corto, para la rejilla de datos (con la etiqueta «Plazas libres»)
  return available <= 0 ? 'Completo' : `${available} de ${offered}`;
}
