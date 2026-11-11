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
  IonSpinner,
} from '@ionic/angular';
import { carOutline, leafOutline } from 'ionicons/icons';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { ReviewTarget, TripReviewCard } from '../trip-review/trip-review-card';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { TRIP_STATUS_LABELS } from '../../../shared/utils/trip-status.util';
import { estimateTripImpact } from '../../matching/trip-impact';
import { formatTime } from '../../matching/trip-results';
import { DriverTripActions } from '../driver-trip-actions/driver-trip-actions';
import { DriverTripPassengers } from '../driver-trip-passengers/driver-trip-passengers';
import { DriverTripRoute } from '../driver-trip-route/driver-trip-route';
import { LiveTripBanner } from '../my-trips/live-trip-banner/live-trip-banner';
import { formatRoute, occupiedSeats } from '../my-trips/my-trips-summary';

// El detalle de un viaje publicado. En escritorio, columna de 8 con el
// recorrido (mapa, paradas, datos y vehículo) y los pasajeros (plazas,
// solicitudes y chat); a la derecha, la de 4 con lo que se puede hacer
// (iniciar, terminar, cancelar) y el impacto estimado. En el móvil, todo en
// una columna. Cuándo, el estado y el papel van en la franja fija del título
// (HeadingContentService), como el chat
@Component({
  selector: 'app-driver-trip-detail',
  imports: [
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
    IonSpinner,
    DriverTripActions,
    DriverTripPassengers,
    DriverTripRoute,
    LiveTripBanner,
    TripReviewCard,
  ],
  templateUrl: './driver-trip-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './driver-trip-detail.page.scss'],
})
export class DriverTripDetailPage {
  private readonly driver = inject(DriverService);
  private readonly headingContent = inject(HeadingContentService);

  readonly id = input.required<string>();
  private readonly tripHeading = viewChild.required<TemplateRef<unknown>>('tripHeading');
  // A la vista: al volver a la pantalla, las pestañas ya han limpiado la franja
  private readonly isVisible = signal(true);

  constructor() {
    effect(() => {
      const template = this.tripHeading();
      if (this.isVisible() && this.trip()) {
        this.headingContent.show(template);
      } else {
        this.headingContent.clear(template);
      }
    });
    inject(DestroyRef).onDestroy(() => this.headingContent.clear(this.tripHeading()));
  }

  // Tras la navegación (que limpia la franja), la vuelve a poner
  ionViewDidEnter(): void {
    this.isVisible.set(true);
  }

  ionViewWillLeave(): void {
    this.isVisible.set(false);
  }

  // Terminado: los pasajeros que tuvieron plaza, para valorarlos (RF-22)
  private readonly finishedRequests = resource({
    params: () => (this.trip()?.status === 'finished' ? this.trip()?.id : undefined),
    loader: ({ params: tripId }) => this.driver.listTripRequests(tripId),
  });
  readonly reviewTargets = computed<ReviewTarget[]>(() =>
    (this.finishedRequests.hasValue() ? this.finishedRequests.value() : [])
      .filter((request) => request.status === 'accepted')
      .map((request) => ({ id: request.passenger.id, name: getFirstName(request.passenger.name) })),
  );

  readonly trips = resource({
    params: () => this.id(),
    loader: () => this.driver.listMyTrips(),
  });
  readonly trip = computed(() =>
    this.trips.hasValue() ? (this.trips.value().find(({ id }) => id === this.id()) ?? null) : null,
  );

  // «Mañana · 08:00»
  readonly when = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const day = new Date(trip.departureAt).toLocaleDateString('sv-SE');
    return `${formatDateLabel(day)} · ${formatTime(trip.departureAt)}`;
  });
  readonly statusLabel = computed(() => {
    const trip = this.trip();
    return trip ? TRIP_STATUS_LABELS[trip.status] : '';
  });

  // Un coche menos por pasajero; el CO₂, el de un coche en ese trayecto por
  // cada uno (estimado, como en Tus viajes)
  readonly impact = computed(() => {
    const trip = this.trip();
    if (!trip || trip.status === 'cancelled') {
      return null;
    }
    const passengers = trip.offeredSeats - trip.availableSeats;
    const perCar =
      estimateTripImpact(trip.origin.coordinates, trip.destination.coordinates)?.co2Kg ?? 0;
    return {
      cars: passengers,
      co2: `${(perCar * passengers).toFixed(1).replace('.', ',')} kg`,
    };
  });

  protected readonly carIcon = carOutline;
  protected readonly leafIcon = leafOutline;

  // Con el viaje en curso, el mismo aviso que en Tus viajes, que lleva a En curso
  readonly liveBanner = computed(() => {
    const trip = this.trip();
    if (trip?.status !== 'in_progress') {
      return null;
    }
    return {
      route: formatRoute(trip),
      detail: `${occupiedSeats(trip)} de ${trip.offeredSeats} plazas ocupadas`,
      link: `/tabs/trips/drive/${trip.id}`,
    };
  });

  handleReload(): void {
    this.trips.reload();
  }
}
