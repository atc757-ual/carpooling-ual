// «1 plaza», «3 plazas»
export function formatSeats(seats: number): string {
  return seats === 1 ? '1 plaza' : `${seats} plazas`;
}
