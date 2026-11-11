import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  resource,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  informationCircleOutline,
  personOutline,
  timeOutline,
} from 'ionicons/icons';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatTime } from '../../matching/trip-results';
import { passengerRequestLabel, passengerTripTab } from '../my-trips/trip-tabs';
import { PassengerProgress } from './passenger-progress/passenger-progress';
import { PassengerRequestActions } from './passenger-request-actions/passenger-request-actions';
import { PassengerRequestRoute } from './passenger-request-route/passenger-request-route';
import { TripReviewCard } from '../trip-review/trip-review-card';

// Desde cuánto antes de la salida ve el pasajero su código de recogida
const BOARD_CODE_LEAD_MS = 10 * 60_000;

// Detalle de la solicitud del pasajero (compartido por Tus viajes, Avisos y
// Buscar). Cabecera fija con «Viajas · Hoy · 22:20» («Viajaste» si terminó) y el estado en su píldora;
// en escritorio, columna de 8 (tarjeta de estado con el aviso y el progreso,
// código de recogida, mapa en vivo, «Tu recorrido» y «Conductor y coche») y
// columna de 4 («Acciones de tu solicitud»)
@Component({
  selector: 'app-passenger-request-detail',
  imports: [
    RouterLink,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSpinner,
    PassengerProgress,
    PassengerRequestRoute,
    PassengerRequestActions,
    TripReviewCard,
  ],
  templateUrl: './passenger-request-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './passenger-request-detail.page.scss'],
})
export class PassengerRequestDetailPage {
  private readonly requests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly headingContent = inject(HeadingContentService);

  readonly id = input.required<string>();
  private readonly requestHeading = viewChild.required<TemplateRef<unknown>>('requestHeading');

  readonly requestResource = resource({
    params: () => this.id(),
    loader: async ({ params }): Promise<SeatRequest> => {
      const request = (await this.requests.listMine()).find((item) => item.id === params);
      if (!request) {
        throw new Error('Request not found');
      }
      return request;
    },
  });
  private readonly requestOverride = signal<SeatRequest | null>(null);
  readonly request = computed(
    () =>
      this.requestOverride() ??
      (this.requestResource.hasValue() ? this.requestResource.value() : null),
  );
  readonly tripResource = resource({
    params: () => this.request()?.trip.id,
    loader: ({ params }) => this.trips.getTrip(params),
  });
  readonly trip = computed(() => (this.tripResource.hasValue() ? this.tripResource.value() : null));

  readonly isPageVisible = signal(true);
  private readonly now = signal(Date.now());

  // El código se ve desde 10 min antes de la salida (cuando el conductor ya
  // puede iniciar) o en cuanto inicia: así lo tiene aunque al subir no haya
  // conexión
  readonly isBoardCodeVisible = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return false;
    }
    if (trip.status === 'in_progress') {
      return true;
    }
    return Date.parse(trip.departureAt) - this.now() <= BOARD_CODE_LEAD_MS;
  });

  readonly when = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const date = new Date(trip.departureAt).toLocaleDateString('sv-SE');
    return `${formatDateLabel(date)} · ${formatTime(trip.departureAt)}`;
  });

  readonly statusLabel = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return request && trip ? passengerRequestLabel(request, trip) : '';
  });

  readonly statusKind = computed<'pending' | 'accepted' | 'danger' | 'neutral'>(() => {
    const request = this.request();
    const trip = this.trip();
    if (!request || !trip) {
      return 'neutral';
    }
    const tab = passengerTripTab(request, trip);
    if (tab === 'cancelled') {
      return 'danger';
    }
    if (tab === 'past') {
      return 'neutral';
    }
    return request.status === 'pending' ? 'pending' : 'accepted';
  });

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));

    effect(() => {
      const template = this.requestHeading();
      if (this.isPageVisible() && this.request() && this.trip()) {
        this.headingContent.show(template);
      } else {
        this.headingContent.clear(template);
      }
    });
    inject(DestroyRef).onDestroy(() => this.headingContent.clear(this.requestHeading()));

    // Mientras está pendiente y a la vista, se revisa cada 30 s (#286)
    effect((onCleanup) => {
      if (!this.isPageVisible() || this.request()?.status !== 'pending') {
        return;
      }
      const timer = setInterval(() => this.refreshRequest(), 30_000);
      onCleanup(() => clearInterval(timer));
    });
  }

  ionViewWillEnter(): void {
    this.isPageVisible.set(true);
    if (this.requestResource.hasValue()) {
      this.refreshRequest();
    }
  }

  ionViewDidEnter(): void {
    this.isPageVisible.set(true);
  }

  ionViewWillLeave(): void {
    this.isPageVisible.set(false);
  }

  ionViewDidLeave(): void {
    this.isPageVisible.set(false);
  }

  handleCancelled(updated: SeatRequest): void {
    this.requestOverride.set(updated);
  }

  private refreshRequest(): void {
    this.requestOverride.set(null);
    this.requestResource.reload();
  }

  protected readonly firstName = (name: string) => getFirstName(name);
  protected readonly personIcon = personOutline;
  protected readonly alertIcon = alertCircleOutline;
  protected readonly pendingIcon = timeOutline;
  protected readonly acceptedIcon = checkmarkCircleOutline;
  protected readonly dangerIcon = closeCircleOutline;
  protected readonly infoIcon = informationCircleOutline;
}
