import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { RATING_ICON, RATING_ICON_EMPTY, RATING_MAX } from '../../../utils/rating.util';

// La nota de una reseña con cinco medallas, como un reconocimiento: las de la
// nota, rellenas en dorado, y el resto vacías en gris (3 → tres
// rellenas y dos vacías). Para el lector de pantalla, «Valoración 3 de 5»
@Component({
  selector: 'app-rating-medals',
  imports: [IonIcon, TranslocoPipe],
  template: `
    <span
      class="rating-medals"
      role="img"
      [attr.aria-label]="'driverReviews.ratingAria' | transloco: { rating: rating() }"
    >
      @for (isFilled of medals(); track $index) {
        <ion-icon
          class="rating-medals__medal"
          [class.rating-medals__medal--filled]="isFilled"
          [icon]="isFilled ? filledIcon : emptyIcon"
          aria-hidden="true"
        />
      }
    </span>
  `,
  styleUrl: './rating-medals.scss',
})
export class RatingMedals {
  readonly rating = input.required<number>();

  protected readonly filledIcon = RATING_ICON;
  protected readonly emptyIcon = RATING_ICON_EMPTY;

  readonly medals = computed(() =>
    Array.from({ length: RATING_MAX }, (_, index) => index < this.rating()),
  );
}
