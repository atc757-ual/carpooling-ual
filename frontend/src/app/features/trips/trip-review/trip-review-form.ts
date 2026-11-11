import { Component, inject, input, output, signal } from '@angular/core';
import { IonButton, IonIcon, IonTextarea } from '@ionic/angular';
import { thumbsDown, thumbsDownOutline, thumbsUp, thumbsUpOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import {
  GivenReview,
  MAX_REVIEW_COMMENT_LENGTH,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';

// Una manita arriba o abajo: la API guarda de 1 a 5 estrellas (RF-22) y aquí
// se envía 5 o 1 (decidido con el autor el 11/11; revisar con el director)
export const THUMB_UP_RATING = 5;
export const THUMB_DOWN_RATING = 1;

// Si una valoración (de 1 a 5) cuenta como manita arriba
export function isThumbUp(rating: number): boolean {
  return rating >= 3;
}

// Valorar a quien ha viajado contigo (RF-22): una manita arriba o abajo, un comentario
// opcional, «Enviar valoración» y, si se puede dejar para luego, «Ahora no».
// En En curso al llegar y en el detalle del viaje terminado
@Component({
  selector: 'app-trip-review-form',
  imports: [IonButton, IonIcon, IonTextarea],
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
  readonly isSending = signal(false);
  readonly error = signal<string | null>(null);
  protected readonly options = [
    {
      rating: THUMB_UP_RATING,
      label: 'Buen viaje',
      tone: 'up',
      icon: thumbsUpOutline,
      iconOn: thumbsUp,
    },
    {
      rating: THUMB_DOWN_RATING,
      label: 'Mejorable',
      tone: 'down',
      icon: thumbsDownOutline,
      iconOn: thumbsDown,
    },
  ];
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
