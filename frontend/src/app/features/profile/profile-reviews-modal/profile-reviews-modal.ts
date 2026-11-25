import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Input,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { IonIcon, IonSpinner, ModalController } from '@ionic/angular';
import { checkmarkCircleOutline, thumbsDown, thumbsUp } from 'ionicons/icons';
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
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { getInitials } from '../../matching/trip-driver/trip-driver';
import { reviewRoleLabel } from '../profile-review-roles';

const PAGE_SIZE = 5;
const DATE_FORMAT = () => dateTimeFormat({ day: 'numeric', month: 'short', year: 'numeric' });

// Las reseñas que he recibido con un papel, desde su fila de «Reseñas» en Mi
// perfil (cada fila abre la suya, sin pestañas), en una hoja de alto fijo que
// se desplaza dentro, como los comentarios de las redes sociales: el resumen
// (media y reparto por nota) y la lista, las más recientes primero, de 5 en 5:
// al bajar hasta el final se cargan solas las siguientes («Cargando más
// reseñas…») y, cuando no quedan, «Has visto todas». Cada reseña, con quién la
// escribió, la fecha, la nota, el comentario y el viaje
@Component({
  selector: 'app-profile-reviews-modal',
  imports: [IonIcon, IonSpinner, ModalHeader, RatingSummary, TranslocoPipe],
  templateUrl: './profile-reviews-modal.html',
  styleUrl: './profile-reviews-modal.scss',
})
export class ProfileReviewsModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly tripReviews = inject(TripReviewsService);

  protected readonly upIcon = thumbsUp;
  protected readonly downIcon = thumbsDown;
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
  // «6 valoraciones», en el cierre (como en el resumen)
  readonly totalText = computed(() => formatReviewCount(this.total()));

  // El final de la lista: al verse (bajando hasta él), se cargan las 5
  // siguientes
  private readonly listEnd = viewChild<ElementRef<HTMLElement>>('listEnd');

  // Un observador nuevo con cada carga: si el final sigue a la vista (las que
  // hay no llenan la hoja), avisa enseguida y se cargan más. Se desconecta al
  // cargar y al cerrar
  constructor() {
    effect((onCleanup) => {
      this.reviews();
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
