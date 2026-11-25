import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { IonCard, IonCardContent, IonCardHeader, IonCardTitle } from '@ionic/angular';
import {
  GivenReview,
  ReviewTargetRole,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { RatingMedals } from '../../../shared/components/ui/rating-medals/rating-medals';
import { ratingName } from '../../../shared/utils/rating.util';
import { TripReviewForm } from './trip-review-form';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';

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
    LoadingState,
    NgTemplateOutlet,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    RatingMedals,
    TripReviewForm,
    TranslocoPipe,
  ],
  templateUrl: './trip-review-card.html',
  styleUrl: './trip-review-card.scss',
})
export class TripReviewCard {
  private readonly reviews = inject(TripReviewsService);

  readonly tripId = input.required<string>();
  readonly targets = input.required<ReviewTarget[]>();
  readonly targetRole = input.required<ReviewTargetRole>();
  readonly title = input(translate('screens.tripReviewCard.valoracion'));
  // De uno en uno (en la hoja de «En curso» del conductor): solo el primero
  // que falta, con «1 de 2» y «Ahora no»; al acabar, un resumen en una línea
  // por persona. Si no, todos a la vez (en el detalle del viaje)
  readonly isStepped = input(false);
  // De uno en uno pero en su propia tarjeta, con el título y «1 de 2» (en el
  // detalle del viaje del conductor)
  readonly isCarded = input(false);
  // De uno en uno: ya no queda nadie por valorar (cargadas y sin pendientes)
  readonly stepsDone = output<void>();
  // De uno en uno: en cuál va («1 de 2»), para la cabecera de quien la usa;
  // null al acabar
  readonly stepChange = output<{ number: number; total: number } | null>();

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
  // Valoró a alguien desde aquí (para el «¡Gracias por valorar!» del resumen)
  readonly hasSentHere = computed(() => this.justSent().size > 0);

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

  // De uno en uno: los que dejó para luego con «Ahora no»
  private readonly skippedIds = signal<ReadonlySet<string>>(new Set());
  // El que toca valorar (el primero pendiente que no ha saltado) y su número
  readonly currentStep = computed(() => {
    const sections = this.sections();
    const index = sections.findIndex(
      ({ target, view }) => view.kind === 'pending' && !this.skippedIds().has(target.id),
    );
    return index === -1 ? null : { ...sections[index], number: index + 1, total: sections.length };
  });
  readonly skipped = this.skippedIds.asReadonly();

  protected readonly ratingName = ratingName;

  constructor() {
    effect(() => {
      if (!this.isStepped() || this.sections().length === 0) {
        return;
      }
      const step = this.currentStep();
      this.stepChange.emit(step ? { number: step.number, total: step.total } : null);
      if (step === null) {
        this.stepsDone.emit();
      }
    });
  }

  handleSent(targetId: string, review: GivenReview | null): void {
    this.justSent.update((current) => new Map(current).set(targetId, review));
  }

  handleSkip(targetId: string): void {
    this.skippedIds.update((current) => new Set([...current, targetId]));
  }
}
