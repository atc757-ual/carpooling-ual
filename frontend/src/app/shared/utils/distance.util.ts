// Una distancia a pie, redondeada como se dice: «350 m» o «1,2 km»
export function formatWalkingDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters / 10) * 10} m`;
  }
  return `${(meters / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
}
