// Valoraciones de 1 a 5 (RF-22), en una escala de 5 puntos entre la manita
// abajo y la manita arriba (decidido con el autor el 15/11): los mismos textos
// al valorar y al mostrar la media
export const RATING_MAX = 5;

const RATING_LABELS: Readonly<Record<number, string>> = {
  1: 'Muy mal',
  2: 'Mal',
  3: 'Normal',
  4: 'Bien',
  5: 'Muy bien',
};

// «Muy mal» … «Muy bien» para una nota de 1 a 5 (redondeada)
export function ratingName(rating: number): string {
  const rounded = Math.min(RATING_MAX, Math.max(1, Math.round(rating)));
  return RATING_LABELS[rounded];
}

// «4,6 de 5» (con un decimal, coma española)
export function formatRating(average: number): string {
  return `${average.toLocaleString('es-ES', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} de ${RATING_MAX}`;
}

// «4,6 de 5 · 12 valoraciones» (o «1 valoración»)
export function formatRatingSummary(average: number, count: number): string {
  const reviews = count === 1 ? '1 valoración' : `${count} valoraciones`;
  return `${formatRating(average)} · ${reviews}`;
}
