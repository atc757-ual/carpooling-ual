import { TranslocoPipe } from '@jsverse/transloco';
import { Component, inject, input, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonTextarea } from '@ionic/angular';
import { addOutline, thumbsDownOutline, thumbsUpOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import {
  GivenReview,
  MAX_REVIEW_COMMENT_LENGTH,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { RATING_MAX, ratingName } from '../../../shared/utils/rating.util';

// Valorar a quien ha viajado contigo (RF-22): 5 botones con su número entre la
// manita abajo y la manita arriba (de 1 a 5, decidido con el autor el 15/11),
// un comentario opcional que se abre al pedirlo (17/11), «Enviar valoración»
// y, si se puede dejar para luego, «Ahora no» debajo.
// En En curso al llegar y en el detalle del viaje terminado
@Component({
  selector: 'app-trip-review-form',
  imports: [IonButton, IonIcon, IonTextarea, TranslocoPipe],
  templateUrl: './trip-review-form.html',
  styleUrl: './trip-review-form.scss',
})
export class TripReviewForm {
  private readonly reviews = inject(TripReviewsService);

  readonly tripId = input.required<string>();
  readonly targetId = input.required<string>();
  readonly targetName = input.required<string>();
  // «Ahora no» (en En curso; en el detalle se puede valorar más tarde igual)
  readonly canSkip = input(false);
  // Enviada (o ya lo estaba): null si ya existía y no se tiene el detalle
  readonly sent = output<GivenReview | null>();
  readonly skipped = output<void>();

  readonly rating = signal(0);
  readonly comment = signal('');
  readonly isCommentOpen = signal(false);
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  protected readonly options = Array.from({ length: RATING_MAX }, (_, index) => index + 1);
  protected readonly ratingName = ratingName;
  protected readonly upIcon = thumbsUpOutline;
  protected readonly downIcon = thumbsDownOutline;
  protected readonly addIcon = addOutline;
  protected readonly maxComment = MAX_REVIEW_COMMENT_LENGTH;

  async handleSend(): Promise<void> {
    if (this.rating() === 0 || this.isSending()) {
      return;
    }
    this.isSending.set(true);
    this.error.set(null);
    try {
      const review = await this.reviews.create(this.tripId(), {
        targetId: this.targetId(),
        rating: this.rating(),
        comment: this.comment().trim() || null,
      });
      this.sent.emit(review);
    } catch (error) {
      const apiError = ApiError.fromHttpError(error);
      // Ya lo había valorado (p. ej. desde otro dispositivo): se da por hecho
      if (apiError.code === 'REVIEW_ALREADY_EXISTS') {
        this.sent.emit(null);
      } else {
        this.error.set(getErrorMessage(apiError));
      }
    } finally {
      this.isSending.set(false);
    }
  }
}
