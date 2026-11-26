import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
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
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
} from '@ionic/angular';
import {
  alertCircleOutline,
  carOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  informationCircleOutline,
  paperPlaneOutline,
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
import { isRelocatable, RelocationCard } from './relocation-card/relocation-card';
import { TripReviewCard } from '../trip-review/trip-review-card';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { Translate } from '../../../core/i18n/translate';
import { buildLiveShareText } from '../trip-share-text';
import { Trip } from '../../../core/models/driver.model';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/components/ui/empty-state/empty-state';
import { localizedComputed } from '../../../core/i18n/localized-computed';

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
    EmptyState,
    LoadingState,
    RouterLink,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    PassengerProgress,
    PassengerRequestRoute,
    PassengerRequestActions,
    RelocationCard,
    TripReviewCard,
    TranslocoPipe,
  ],
  templateUrl: './passenger-request-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './passenger-request-detail.page.scss'],
})
export class PassengerRequestDetailPage {
  private readonly requests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly headingContent = inject(HeadingContentService);
  private readonly tripShare = inject(TripShareService);
  private readonly transloco = inject(TranslocoService);
  private readonly translate: Translate = (key, params) => this.transloco.translate(key, params);

  readonly id = input.required<string>();
  protected readonly isRelocatable = isRelocatable;
  private readonly requestHeading = viewChild.required<TemplateRef<unknown>>('requestHeading');
  // Para abrir «Reportar» desde la lista «Viaje y seguridad»
  protected readonly actions = viewChild(PassengerRequestActions);

  readonly requestResource = resource({
    params: () => this.id(),
    loader: ({ params }): Promise<SeatRequest> => this.requests.getMine(params),
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
  protected readonly now = signal(Date.now());

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

  readonly when = localizedComputed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const date = new Date(trip.departureAt).toLocaleDateString('sv-SE');
    return `${formatDateLabel(date)} · ${formatTime(trip.departureAt)}`;
  });

  readonly statusLabel = localizedComputed(() => {
    const request = this.request();
    const trip = this.trip();
    return request && trip ? passengerRequestLabel(request, trip) : '';
  });

  // Ya viajó: el viaje terminó o él ya se bajó (cierre por pasajero)
  readonly hasTravelled = computed(
    () => this.trip()?.status === 'finished' || this.request()?.status === 'completed',
  );

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

  // Compartir el viaje con alguien de confianza (el menú del sistema): el
  // trayecto, quién conduce, el coche y la matrícula
  async handleShare(request: SeatRequest, trip: Trip): Promise<void> {
    const text = buildLiveShareText(trip, this.translate, {
      name: trip.driver.name,
      vehicleName: trip.vehicle ? vehicleDisplayName(trip.vehicle) : null,
      plate: request.vehiclePlate ?? null,
    });
    await this.tripShare.share({ title: this.translate('share.liveTitle'), text });
  }

  protected readonly firstName = (name: string) => getFirstName(name);
  protected readonly personIcon = personOutline;
  // El coche, como la pestaña «En curso»
  protected readonly liveIcon = carOutline;
  protected readonly shareIcon = paperPlaneOutline;
  protected readonly alertIcon = alertCircleOutline;
  protected readonly pendingIcon = timeOutline;
  protected readonly acceptedIcon = checkmarkCircleOutline;
  protected readonly dangerIcon = closeCircleOutline;
  protected readonly infoIcon = informationCircleOutline;
}
