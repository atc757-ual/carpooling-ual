import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { IonSpinner, ModalController } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating, DriverReview } from '../../../core/models/driver-review.model';
import { DriverReviewsService } from '../../../core/services/users/driver-reviews.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { RatingBar } from '../../../shared/components/ui/rating-bar/rating-bar';
import { RatingSummary } from '../../../shared/components/ui/rating-summary/rating-summary';
import {
  REVIEW_PAGE_SIZE,
  ReviewList,
  ReviewListItem,
} from '../../../shared/components/ui/review-list/review-list';
import { ScrollHintButton } from '../../../shared/components/ui/scroll-hint/scroll-hint';
import { ScrollHint } from '../../../shared/directives/scroll-hint.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getFirstName } from '../trip-driver/trip-driver';
import { localizedComputed } from '../../../core/i18n/localized-computed';

// Las valoraciones de quien conduce, al pulsar su nota en un resultado o en el
// detalle del viaje: la media, cuántas hay de cada nota y la lista
// (app-review-list, como «Tus reseñas»), las más recientes primero, de 5 en 5:
// al bajar hasta el final se cargan solas las siguientes
@Component({
  selector: 'app-driver-reviews-modal',
  imports: [
    ModalHeader,
    IonSpinner,
    RatingBar,
    RatingSummary,
    ReviewList,
    ScrollHint,
    ScrollHintButton,
    TranslocoPipe,
  ],
  templateUrl: './driver-reviews-modal.html',
  styleUrl: './driver-reviews-modal.scss',
})
export class DriverReviewsModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly driverReviews = inject(DriverReviewsService);

  @Input() driverId = '';
  @Input() driverName = '';

  readonly rating = signal<DriverRating | null>(null);
  readonly reviews = signal<DriverReview[]>([]);
  readonly total = signal(0);
  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly title = localizedComputed(() =>
    translate('labels.reviewsOf', { name: getFirstName(this.driverName) }),
  );
  // La nota, si ya tiene media (sin reseñas, el aviso de que aún no tiene)
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
    })),
  );

  ngOnInit(): void {
    void this.load();
  }

  close(): void {
    void this.modalController.dismiss();
  }

  // Al llegar al final: solo si quedan y no se está cargando ya
  async loadMoreIfAny(): Promise<void> {
    if (this.reviews().length >= this.total() || this.isLoading()) {
      return;
    }
    this.isLoading.set(true);
    try {
      const page = await this.driverReviews.list(
        this.driverId,
        this.reviews().length,
        REVIEW_PAGE_SIZE,
      );
      this.reviews.update((reviews) => [...reviews, ...page.items]);
      this.total.set(page.total);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isLoading.set(false);
    }
  }

  private async load(): Promise<void> {
    try {
      const [rating, page] = await Promise.all([
        this.driverReviews.getRating(this.driverId),
        this.driverReviews.list(this.driverId, 0, REVIEW_PAGE_SIZE),
      ]);
      this.rating.set(rating);
      this.reviews.set(page.items);
      this.total.set(page.total);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isLoading.set(false);
    }
  }
}
