import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { numberFormat } from '../../../../core/i18n/app-locale';
import { DriverRating } from '../../../../core/models/driver-review.model';
import { RATING_ICON, RATING_MAX, ratingName } from '../../../utils/rating.util';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

const RATING_FORMAT = () =>
  numberFormat({
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

// «1 valoración», «15 valoraciones»
export function formatReviewCount(count: number): string {
  return translate(count === 1 ? 'labels.rating.reviews.one' : 'labels.rating.reviews.other', {
    count,
  });
}

// La fila del reparto: «5 · Excelente» y «1 · Correcto» en los extremos; el
// resto, solo el número
export function barLabel(rating: number): string {
  return rating === 1 || rating === RATING_MAX ? `${rating} · ${ratingName(rating)}` : `${rating}`;
}

// El resumen de una nota: la media grande con la medalla y cuántas valoraciones
// hay, y a la derecha una barra por cada nota. Lo usan las valoraciones de
// quien conduce (en la búsqueda) y «Tus reseñas» (Mi perfil). Sin media (aún
// sin reseñas), no pinta nada
@Component({
  selector: 'app-rating-summary',
  imports: [IonIcon, TranslocoPipe],
  templateUrl: './rating-summary.html',
  styleUrl: './rating-summary.scss',
})
export class RatingSummary {
  readonly rating = input.required<DriverRating>();

  protected readonly medalIcon = RATING_ICON;

  readonly average = computed(() => {
    const average = this.rating().average;
    return average === null ? null : RATING_FORMAT().format(average);
  });
  readonly countText = localizedComputed(() => formatReviewCount(this.rating().count));
  // Cada nota con su parte de la barra (en % del total)
  readonly bars = localizedComputed(() => {
    const { count, distribution } = this.rating();
    return distribution.map((row) => ({
      ...row,
      label: barLabel(row.rating),
      percent: count > 0 ? Math.round((row.count / count) * 100) : 0,
    }));
  });
}
