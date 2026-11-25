import { Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { thumbsUp, thumbsUpOutline } from 'ionicons/icons';
import { RATING_MAX } from '../../../utils/rating.util';

// La nota de una reseña con cinco manitas: verdes hasta la nota y el resto
// blancas con el borde azul (3 → tres verdes y dos blancas). Para el lector de
// pantalla, «3 de 5»
@Component({
  selector: 'app-rating-thumbs',
  imports: [IonIcon, TranslocoPipe],
  template: `
    <span
      class="rating-thumbs"
      role="img"
      [attr.aria-label]="'driverReviews.ratingAria' | transloco: { rating: rating() }"
    >
      @for (isFilled of thumbs(); track $index) {
        <ion-icon
          class="rating-thumbs__thumb"
          [class.rating-thumbs__thumb--filled]="isFilled"
          [icon]="isFilled ? filledIcon : outlineIcon"
          aria-hidden="true"
        />
      }
    </span>
  `,
  styleUrl: './rating-thumbs.scss',
})
export class RatingThumbs {
  readonly rating = input.required<number>();

  protected readonly filledIcon = thumbsUp;
  protected readonly outlineIcon = thumbsUpOutline;

  readonly thumbs = computed(() =>
    Array.from({ length: RATING_MAX }, (_, index) => index < this.rating()),
  );
}
