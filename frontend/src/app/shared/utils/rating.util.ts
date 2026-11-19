import { translate } from '@jsverse/transloco';
import { appLocale } from '../../core/i18n/app-locale';

// Valoraciones de 1 a 5 (RF-22), en una escala de 5 puntos entre la manita
// abajo y la manita arriba (decidido con el autor el 15/11): los mismos textos
// al valorar y al mostrar la media
export const RATING_MAX = 5;

// «Muy mal» … «Muy bien» para una nota de 1 a 5 (redondeada)
export function ratingName(rating: number): string {
  const rounded = Math.min(RATING_MAX, Math.max(1, Math.round(rating)));
  return translate(`labels.rating.name${rounded}`);
}

// «4,6 de 5» (con un decimal, con la coma o el punto del idioma)
export function formatRating(average: number): string {
  const value = average.toLocaleString(appLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return translate('labels.rating.ofMax', { value, max: RATING_MAX });
}

// «4,6 de 5 · 12 valoraciones» (o «1 valoración»)
export function formatRatingSummary(average: number, count: number): string {
  const reviews = translate(
    count === 1 ? 'labels.rating.reviews.one' : 'labels.rating.reviews.other',
    {
      count,
    },
  );
  return `${formatRating(average)} · ${reviews}`;
}
