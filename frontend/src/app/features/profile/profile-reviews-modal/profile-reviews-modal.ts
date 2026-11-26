import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { IonSpinner, ModalController } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating } from '../../../core/models/driver-review.model';
import {
  ReceivedReview,
  ReviewTargetRole,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { RatingSummary } from '../../../shared/components/ui/rating-summary/rating-summary';
import {
  REVIEW_PAGE_SIZE,
  ReviewList,
  ReviewListItem,
} from '../../../shared/components/ui/review-list/review-list';
import { ScrollHintButton } from '../../../shared/components/ui/scroll-hint/scroll-hint';
import { ScrollHint } from '../../../shared/directives/scroll-hint.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { reviewRoleLabel } from '../profile-review-roles';
import { localizedComputed } from '../../../core/i18n/localized-computed';

// El viaje de una reseña: «Roquetas de Mar → Campus UAL»
function routeOf(review: ReceivedReview): string {
  return [review.trip.originName, review.trip.destinationName]
    .filter((name) => name !== null)
    .join(' → ');
}

// Las reseñas que he recibido con un papel, desde su fila de «Reseñas» en Mi
// perfil (cada fila abre la suya, sin pestañas): el resumen (media y reparto
// por nota) y la lista (app-review-list), las más recientes primero, de 5 en
// 5: al bajar hasta el final se cargan solas las siguientes. Cada reseña, con
// el viaje
@Component({
  selector: 'app-profile-reviews-modal',
  imports: [
    IonSpinner,
    ModalHeader,
    RatingSummary,
    ReviewList,
    ScrollHint,
    ScrollHintButton,
    TranslocoPipe,
  ],
  templateUrl: './profile-reviews-modal.html',
  styleUrl: './profile-reviews-modal.scss',
})
export class ProfileReviewsModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly tripReviews = inject(TripReviewsService);

  // El papel de la fila pulsada
  @Input() role: ReviewTargetRole = 'driver';

  private readonly rating = signal<DriverRating | null>(null);
  private readonly reviews = signal<ReceivedReview[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // «Tus reseñas · Conductor»
  readonly title = localizedComputed(() =>
    translate('profile.reviewsModal.titleRole', { role: reviewRoleLabel(this.role) }),
  );
  // La nota, si ya tiene media
  readonly summary = computed(() => {
    const rating = this.rating();
    return rating && rating.average !== null ? rating : null;
  });
  readonly items = computed<ReviewListItem[]>(() =>
    this.reviews().map((review) => ({
      id: review.id,
      authorName: review.author.name,
      publishedAt: review.publishedAt,
      rating: review.rating,
      comment: review.comment,
      route: routeOf(review),
    })),
  );

  ngOnInit(): void {
    void this.load(0);
  }

  // Al llegar al final: solo si quedan y no se está cargando ya
  loadMoreIfAny(): Promise<void> {
    return this.reviews().length < this.total() && !this.isLoading()
      ? this.load(this.reviews().length)
      : Promise.resolve();
  }

  close(): void {
    void this.modalController.dismiss();
  }

  // La primera vez, también la nota del papel
  private async load(offset: number): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const [page, rating] = await Promise.all([
        this.tripReviews.listReceived(this.role, offset, REVIEW_PAGE_SIZE),
        offset === 0 ? this.tripReviews.getMyRating(this.role) : null,
      ]);
      if (rating) {
        this.rating.set(rating);
      }
      this.reviews.update((reviews) => [...reviews, ...page.items]);
      this.total.set(page.total);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isLoading.set(false);
    }
  }
}
