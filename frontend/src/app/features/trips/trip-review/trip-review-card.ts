import { Component, computed, inject, input, resource, signal } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { thumbsDown, thumbsUp } from 'ionicons/icons';
import {
  GivenReview,
  ReviewTargetRole,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { isThumbUp, TripReviewForm } from './trip-review-form';

// A quién se valora: el conductor (lo hace el pasajero) o cada pasajero (lo
// hace el conductor)
export interface ReviewTarget {
  id: string;
  name: string;
}

export type TripReviewView =
  { kind: 'given'; review: GivenReview | null } | { kind: 'pending' } | { kind: 'expired' };

// Valorar a quien viajó contigo en un viaje terminado (RF-22), una sección por
// persona: la valoración que ya diste, solo para leer (no se edita); si no
// valoraste y aún estás en plazo (7 días), el formulario; si no, que el plazo
// terminó. El pasajero valora al conductor; el conductor, a cada pasajero
@Component({
  selector: 'app-trip-review-card',
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    TripReviewForm,
  ],
  templateUrl: './trip-review-card.html',
  styleUrl: './trip-review-card.scss',
})
export class TripReviewCard {
  private readonly reviews = inject(TripReviewsService);

  readonly tripId = input.required<string>();
  readonly targets = input.required<ReviewTarget[]>();
  readonly targetRole = input.required<ReviewTargetRole>();
  readonly title = input('Tu valoración');

  private readonly loaded = resource({
    params: () => ({ tripId: this.tripId(), role: this.targetRole() }),
    loader: async ({ params }) => {
      const [given, pending] = await Promise.all([
        this.reviews.listGiven(params.role),
        this.reviews.listPending(),
      ]);
      const pendingIds = new Set(
        pending
          .filter((item) => item.trip.id === params.tripId)
          .flatMap((item) => item.targets.map((target) => target.id)),
      );
      const givenByTarget = new Map(
        given
          .filter((review) => review.trip.id === params.tripId)
          .map((review) => [review.target.id, review]),
      );
      return { pendingIds, givenByTarget };
    },
  });
  // Las enviadas desde aquí: se muestran sin volver a cargar
  private readonly justSent = signal<Map<string, GivenReview | null>>(new Map());

  readonly isLoading = this.loaded.isLoading;
  readonly hasError = computed(() => Boolean(this.loaded.error()));
  readonly sections = computed(() => {
    if (!this.loaded.hasValue()) {
      return [];
    }
    const { pendingIds, givenByTarget } = this.loaded.value();
    const sent = this.justSent();
    return this.targets().map((target) => {
      let view: TripReviewView = { kind: 'expired' };
      if (sent.has(target.id)) {
        view = { kind: 'given', review: sent.get(target.id) ?? null };
      } else if (givenByTarget.has(target.id)) {
        view = { kind: 'given', review: givenByTarget.get(target.id) ?? null };
      } else if (pendingIds.has(target.id)) {
        view = { kind: 'pending' };
      }
      return { target, view };
    });
  });

  protected readonly isThumbUp = isThumbUp;
  protected readonly upIcon = thumbsUp;
  protected readonly downIcon = thumbsDown;

  handleSent(targetId: string, review: GivenReview | null): void {
    this.justSent.update((current) => new Map(current).set(targetId, review));
  }
}
