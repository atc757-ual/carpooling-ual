import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { IonButton, IonSpinner, ModalController } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating, DriverReview } from '../../../core/models/driver-review.model';
import { DriverReviewsService } from '../../../core/services/users/driver-reviews.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getFirstName, getInitials } from '../trip-driver/trip-driver';

const PAGE_SIZE = 10;
const RATING_FORMAT = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// «1 valoración», «15 valoraciones»
export function formatReviewCount(count: number): string {
  return count === 1 ? '1 valoración' : `${count} valoraciones`;
}

// «★★★★☆» para una nota de 1 a 5
export function toStars(rating: number): string {
  const filled = Math.round(rating);
  return '★'.repeat(filled) + '☆'.repeat(5 - filled);
}

// Las valoraciones de quien conduce, al pulsar su nota en un resultado o en el
// detalle del viaje: la media, cuántas hay de cada estrella y la lista (las
// más recientes primero, de 10 en 10)
@Component({
  selector: 'app-driver-reviews-modal',
  imports: [ModalHeader, IonButton, IonSpinner],
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
  readonly isLoadingMore = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly title = computed(() => `Valoraciones de ${getFirstName(this.driverName)}`);
  readonly average = computed(() => {
    const average = this.rating()?.average;
    return average === null || average === undefined ? null : RATING_FORMAT.format(average);
  });
  readonly countText = computed(() => formatReviewCount(this.rating()?.count ?? 0));
  // Cada estrella con su parte de la barra (en % del total)
  readonly bars = computed(() => {
    const rating = this.rating();
    const count = rating?.count ?? 0;
    return (rating?.distribution ?? []).map((row) => ({
      ...row,
      percent: count > 0 ? Math.round((row.count / count) * 100) : 0,
    }));
  });
  readonly hasMore = computed(() => this.reviews().length < this.total());

  ngOnInit(): void {
    void this.load();
  }

  close(): void {
    void this.modalController.dismiss();
  }

  async loadMore(): Promise<void> {
    this.isLoadingMore.set(true);
    try {
      const page = await this.driverReviews.list(this.driverId, this.reviews().length, PAGE_SIZE);
      this.reviews.update((reviews) => [...reviews, ...page.items]);
      this.total.set(page.total);
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isLoadingMore.set(false);
    }
  }

  initials(name: string): string {
    return getInitials(name);
  }

  stars(rating: number): string {
    return toStars(rating);
  }

  date(isoDate: string): string {
    return DATE_FORMAT.format(new Date(isoDate));
  }

  private async load(): Promise<void> {
    try {
      const [rating, page] = await Promise.all([
        this.driverReviews.getRating(this.driverId),
        this.driverReviews.list(this.driverId, 0, PAGE_SIZE),
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
