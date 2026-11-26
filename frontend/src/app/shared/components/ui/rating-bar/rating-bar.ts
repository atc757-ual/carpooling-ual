import { Component, computed, input } from '@angular/core';
import { formatRating, RATING_MAX } from '../../../utils/rating.util';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

// La nota de 1 a 5 como una barra de 5 puntos (la misma escala que al
// valorar): se rellenan los puntos hasta la nota, el último en parte si la
// media tiene decimales. Solo se lee: el lector de pantalla oye «4,6 de 5»
@Component({
  selector: 'app-rating-bar',
  template: `
    <span
      class="rating-bar"
      [class.rating-bar--small]="size() === 'small'"
      role="img"
      [attr.aria-label]="label()"
    >
      @for (fill of fills(); track $index) {
        <span class="rating-bar__point">
          <span class="rating-bar__fill" [style.width.%]="fill"></span>
        </span>
      }
    </span>
  `,
  styleUrl: './rating-bar.scss',
})
export class RatingBar {
  readonly rating = input.required<number>();
  readonly size = input<'default' | 'small'>('default');

  // Cuánto de cada punto se rellena (0 a 100)
  readonly fills = computed(() => {
    const rating = Math.min(RATING_MAX, Math.max(0, this.rating()));
    return Array.from({ length: RATING_MAX }, (_, index) =>
      Math.round(Math.min(1, Math.max(0, rating - index)) * 100),
    );
  });
  readonly label = localizedComputed(() => formatRating(this.rating()));
}
