import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  Input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import {
  checkmarkCircleOutline,
  chevronBack,
  chevronForward,
  thumbsDown,
  thumbsUp,
} from 'ionicons/icons';
import { dateTimeFormat } from '../../../core/i18n/app-locale';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverRating } from '../../../core/models/driver-review.model';
import {
  ReceivedReview,
  ReviewTargetRole,
  TripReviewsService,
} from '../../../core/services/users/trip-reviews.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import {
  formatReviewCount,
  RatingSummary,
} from '../../../shared/components/ui/rating-summary/rating-summary';
import { DragScroll } from '../../../shared/directives/drag-scroll.directive';
import { ScrollEdges } from '../../../shared/directives/scroll-edges.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getInitials } from '../../matching/trip-driver/trip-driver';
import { reviewRoleLabel } from '../profile-review-roles';

const PAGE_SIZE = 5;
const DATE_FORMAT = () => dateTimeFormat({ day: 'numeric', month: 'short', year: 'numeric' });

// Las reseñas que he recibido con un papel, desde su fila de «Reseñas» en Mi
// perfil (cada fila abre la suya, sin pestañas): el resumen (media y reparto
// por nota) y un carrusel con una tarjeta por reseña, las más recientes
// primero, de 5 en 5: al llegar a la última se cargan solas las siguientes y,
// cuando no quedan, una tarjeta de cierre lo dice. Cada reseña, con quién la
// escribió, la fecha, la nota, el comentario y el viaje
@Component({
  selector: 'app-profile-reviews-modal',
  imports: [
    DragScroll,
    IonIcon,
    IonSpinner,
    ModalHeader,
    RatingSummary,
    ScrollEdges,
    TranslocoPipe,
  ],
  templateUrl: './profile-reviews-modal.html',
  styleUrl: './profile-reviews-modal.scss',
})
export class ProfileReviewsModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly tripReviews = inject(TripReviewsService);

  protected readonly upIcon = thumbsUp;
  protected readonly downIcon = thumbsDown;
  protected readonly backIcon = chevronBack;
  protected readonly forwardIcon = chevronForward;
  protected readonly doneIcon = checkmarkCircleOutline;

  // El papel de la fila pulsada
  @Input() role: ReviewTargetRole = 'driver';

  private readonly rating = signal<DriverRating | null>(null);
  readonly reviews = signal<ReceivedReview[]>([]);
  private readonly total = signal(0);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // «Tus reseñas · Conductor»
  readonly title = computed(() =>
    translate('profile.reviewsModal.titleRole', { role: reviewRoleLabel(this.role) }),
  );
  // La nota, si ya tiene media
  readonly summary = computed(() => {
    const rating = this.rating();
    return rating && rating.average !== null ? rating : null;
  });
  readonly hasMore = computed(() => this.reviews().length < this.total());
  // «6 valoraciones», en la tarjeta de cierre (como en el resumen)
  readonly totalText = computed(() => formatReviewCount(this.total()));

  // El final de la fila: al verse (deslizando hasta la última), se cargan las
  // siguientes
  private readonly listEnd = viewChild<ElementRef<HTMLElement>>('listEnd');
  // Las flechas de los lados (se recalculan al llegar más tarjetas)
  private readonly edges = viewChild(ScrollEdges);

  // El observador se desconecta al cambiar el final de la fila y al cerrar
  constructor() {
    const injector = inject(Injector);
    effect(() => {
      this.reviews();
      afterNextRender(() => this.edges()?.update(), { injector });
    });
    effect((onCleanup) => {
      const end = this.listEnd()?.nativeElement;
      if (!end || typeof IntersectionObserver === 'undefined') {
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(({ isIntersecting }) => isIntersecting)) {
          void this.loadMoreIfAny();
        }
      });
      observer.observe(end);
      onCleanup(() => observer.disconnect());
    });
  }

  ngOnInit(): void {
    void this.load(0);
  }

  // Al llegar al final: solo si quedan y no se está cargando ya
  loadMoreIfAny(): Promise<void> {
    return this.hasMore() && !this.isLoading()
      ? this.load(this.reviews().length)
      : Promise.resolve();
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

  // La primera vez, también la nota del papel
  private async load(offset: number): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    try {
      const [page, rating] = await Promise.all([
        this.tripReviews.listReceived(this.role, offset, PAGE_SIZE),
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
