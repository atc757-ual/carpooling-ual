import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, Input, OnInit, signal } from '@angular/core';
import { IonButton, IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { thumbsDown, thumbsUp } from 'ionicons/icons';
import { dateTimeFormat } from '../../../core/i18n/app-locale';
import { ApiError } from '../../../core/models/api-error.model';
import {
  ReceivedReview,
  ReviewTargetRole,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getInitials } from '../../matching/trip-driver/trip-driver';

const PAGE_SIZE = 10;
const DATE_FORMAT = () => dateTimeFormat({ day: 'numeric', month: 'short', year: 'numeric' });

// Lo que se ha cargado de cada papel (se carga al abrir su pestaña)
interface RoleReviews {
  items: ReceivedReview[];
  total: number;
}

// Las reseñas que he recibido, desde «Reseñas» de Mi perfil: una pestaña por
// papel (como conductor y como pasajero; solo los que tienen reseñas) y en
// cada una la lista, las más recientes primero, de 10 en 10. Cada reseña,
// con quién la escribió, la fecha, la nota, el comentario y el viaje
@Component({
  selector: 'app-profile-reviews-modal',
  imports: [ModalHeader, IonButton, IonIcon, IonSpinner, TranslocoPipe],
  templateUrl: './profile-reviews-modal.html',
  styleUrl: './profile-reviews-modal.scss',
})
export class ProfileReviewsModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly tripReviews = inject(TripReviewsService);

  protected readonly upIcon = thumbsUp;
  protected readonly downIcon = thumbsDown;

  // Los papeles con reseñas, en el orden de las pestañas, y el que se abre
  @Input() roles: ReviewTargetRole[] = ['driver', 'passenger'];
  @Input() initialRole: ReviewTargetRole = 'driver';

  readonly role = signal<ReviewTargetRole>('driver');
  private readonly loaded = signal<Partial<Record<ReviewTargetRole, RoleReviews>>>({});
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly tabs = computed(() =>
    this.roles.map((value) => ({
      value,
      label: translate(
        value === 'driver' ? 'screens.profile.comoConductor' : 'screens.profile.comoPasajero',
      ),
    })),
  );
  readonly reviews = computed(() => this.loaded()[this.role()]?.items ?? []);
  readonly hasMore = computed(() => {
    const current = this.loaded()[this.role()];
    return current !== undefined && current.items.length < current.total;
  });

  ngOnInit(): void {
    this.handleRole(this.roles.includes(this.initialRole) ? this.initialRole : this.roles[0]);
  }

  handleRole(role: ReviewTargetRole): void {
    this.role.set(role);
    if (!this.loaded()[role]) {
      void this.load(role, 0);
    }
  }

  loadMore(): Promise<void> {
    return this.load(this.role(), this.reviews().length);
  }

  close(): void {
    void this.modalController.dismiss();
  }

  initials(name: string): string {
    return getInitials(name);
  }

  date(isoDate: string | null): string {
    return isoDate ? DATE_FORMAT().format(new Date(isoDate)) : '';
  }

  route(review: ReceivedReview): string {
    return [review.trip.originName, review.trip.destinationName]
      .filter((name) => name !== null)
      .join(' → ');
  }

  private async load(role: ReviewTargetRole, offset: number): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const page = await this.tripReviews.listReceived(role, offset, PAGE_SIZE);
      this.loaded.update((loaded) => ({
        ...loaded,
        [role]: { items: [...(loaded[role]?.items ?? []), ...page.items], total: page.total },
      }));
    } catch (error) {
      this.errorMessage.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isLoading.set(false);
    }
  }
}
