import { translate, TranslocoPipe } from '@jsverse/transloco';
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
import { Router, RouterLink } from '@angular/router';
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
  IonRouterLink,
  IonSpinner,
} from '@ionic/angular';
import { carOutline, mapOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { SeatRequestStatus } from '../../../core/models/seat-request.model';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { VehicleColorsStore } from '../../../core/services/catalogs/vehicle-colors.store';
import { PermissionPromptsService } from '../../../core/services/push/permission-prompts.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import {
  RoutePoint,
  TripRouteMap,
} from '../../../shared/components/ui/trip-route-map/trip-route-map';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatAvailableSeats, formatSeats } from '../../../shared/utils/seats.util';
import { vehicleDisplayName } from '../../../shared/utils/vehicle-display.util';
import { getFirstName, TripDriver } from '../trip-driver/trip-driver';
import { formatTime, toTripDetail } from '../trip-results';
import { pickupFact, toRequestPickup } from '../trip-pickup';
import { TripSearchStateService } from '../trip-search-state.service';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';
import { EmptyState } from '../../../shared/components/ui/empty-state/empty-state';

// Solicitudes que ya no siguen: se puede volver a pedir plaza
const CLOSED_REQUEST_STATUSES: ReadonlySet<SeatRequestStatus> = new Set([
  'rejected',
  'cancelled',
  'expired',
]);

// Detalle de un viaje de los resultados de Buscar: cabecera fija con cuándo y
// sentido; en escritorio, columna de 8 con «Tu recorrido» y, debajo, la tarjeta
// para solicitar plaza o gestionar la solicitud, y columna de 4 con «Conductor y
// coche»
@Component({
  selector: 'app-trip-detail',
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
    IonRouterLink,
    IonSpinner,
    RouteTimeline,
    TripDriver,
    TripRouteMap,
    TranslocoPipe,
  ],
  templateUrl: './trip-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-detail.page.scss'],
})
export class TripDetailPage {
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly colors = inject(VehicleColorsStore);
  private readonly searchState = inject(TripSearchStateService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly tripsService = inject(TripsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly permissionPrompts = inject(PermissionPromptsService);
  private readonly headingContent = inject(HeadingContentService);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  private readonly tripHeading = viewChild.required<TemplateRef<unknown>>('tripHeading');
  private readonly isVisible = signal(true);

  readonly trip = computed(() => {
    const search = this.searchState.search();
    const result = this.searchState.results().find(({ id }) => id === this.id());
    return search && result ? toTripDetail(result, search) : null;
  });

  // «Mañana · 23:20 · Ida al campus»
  readonly headingTitle = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const way =
      trip.direction === 'to-campus'
        ? translate('screens.tripDetail.idaCampus')
        : translate('screens.tripDetail.vueltaCampus');
    return `${formatDateLabel(trip.date)} · ${trip.departureTime} · ${way}`;
  });

  readonly tripData = resource({
    params: () => this.trip()?.id,
    loader: async ({ params: tripId }) => {
      const [trip, route] = await Promise.all([
        this.tripsService.getTrip(tripId),
        this.tripsService.getRoute(tripId),
      ]);
      return { trip, route };
    },
  });

  readonly stops = computed<RouteStop[]>(() => {
    const trip = this.trip();
    const data = this.tripData.value();
    const search = this.searchState.search();
    if (!trip || !data || !search) {
      return [];
    }
    const isToCampus = search.direction === 'to-campus';
    const originName =
      data.trip.originName ?? translate<string>('screens.tripDetail.salidaConductor');
    const destinationName = data.trip.destinationName ?? trip.destination;
    const searchedParking = search.parking.name;
    // Sin plaza, la calle del conductor sin el portal (lo quita el backend) y
    // el punto, redondeado: se dice que es una zona, no su casa
    const originDetail = data.trip.isLocationApproximate
      ? translate('screens.tripDetail.salidaConductorZonaAproximada')
      : translate('screens.tripDetail.puntoSalidaConductor');

    if (isToCampus) {
      const destDiffers = !destinationName.includes(searchedParking);
      return [
        {
          name: originName,
          detail: originDetail,
          time: formatTime(data.trip.departureAt),
        },
        {
          name: search.place.name,
          detail: translate('screens.tripDetail.puntoRecogida'),
        },
        {
          name: destinationName,
          detail: destDiffers
            ? translate('screens.tripDetail.destinoViajeBuscabas', { searchedParking })
            : translate('screens.tripDetail.destinoViaje'),
          time: trip.arrivalTime,
        },
      ];
    }

    const originDiffers = !originName.includes(searchedParking);
    return [
      {
        name: originName,
        detail: originDiffers
          ? translate('screens.tripDetail.salidaRecogidaBuscabas', { searchedParking })
          : translate('screens.tripDetail.salidaConductorPuntoRecogida'),
        time: formatTime(data.trip.departureAt),
      },
      {
        name: destinationName,
        detail: search.place.locality || translate('screens.tripDetail.destinoViaje'),
        time: trip.arrivalTime,
      },
    ];
  });

  readonly pickup = computed(() => {
    const search = this.searchState.search();
    const trip = this.tripData.value()?.trip;
    if (!search || !trip) {
      return null;
    }
    return search.direction === 'to-campus'
      ? { coordinates: search.place.coordinates, label: search.place.name }
      : { coordinates: trip.origin.coordinates, label: trip.originName ?? search.parking.name };
  });

  readonly mapEnds = computed<{ origin: RoutePoint; destination: RoutePoint } | null>(() => {
    const search = this.searchState.search();
    const trip = this.tripData.value()?.trip;
    if (!search || !trip) {
      return null;
    }
    const isToCampus = search.direction === 'to-campus';
    return {
      origin: {
        coordinates: trip.origin.coordinates,
        label: trip.originName ?? translate('screens.tripDetail.salidaConductor'),
        isApproximate: trip.isLocationApproximate && isToCampus,
      },
      destination: {
        coordinates: trip.destination.coordinates,
        label: trip.destinationName ?? translate('screens.tripDetail.destinoViaje'),
        isApproximate: trip.isLocationApproximate && !isToCampus,
      },
    };
  });

  readonly seatSummary = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const apiTrip = this.tripData.value()?.trip;
    return apiTrip
      ? formatAvailableSeats(apiTrip.availableSeats, apiTrip.offeredSeats)
      : formatFreeSeats(trip.freeSeats);
  });

  readonly facts = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return [];
    }
    return [
      { label: translate('screens.tripDetail.plazasLibres'), value: this.seatSummary() },
      // Recogerte nunca es 0 min: el desvío más lo que se tarda en parar y subir
      { label: translate('screens.tripDetail.recogida'), value: pickupFact(trip) },
      {
        label: translate('screens.tripDetail.duracion'),
        value: translate('screens.tripDetail.minAprox', { tripMinutes: trip.tripMinutes }),
      },
    ];
  });

  readonly driverFirstName = computed(() => {
    const trip = this.trip();
    return trip ? getFirstName(trip.driver.name) : '';
  });

  readonly driverPreferences = computed(() => {
    const prefs = this.tripData.value()?.trip.driver.preferences ?? this.trip()?.driver.preferences;
    return this.travelPreferences.format(prefs);
  });

  readonly seats = computed(() => this.searchState.search()?.seats ?? 1);
  readonly requestedSeats = computed(() => formatSeats(this.seats()));
  readonly isAutoAccept = computed(() => this.tripData.value()?.trip.autoAccept === true);

  readonly myRequest = resource({
    params: () => this.trip()?.id,
    loader: async ({ params: tripId }) =>
      (await this.seatRequests.listMine()).find(({ trip }) => trip.id === tripId) ?? null,
  });
  readonly request = computed(() => (this.myRequest.hasValue() ? this.myRequest.value() : null));
  // Una solicitud anterior que ya no sigue: su aviso sustituye al de cómo funciona
  readonly hasClosedRequest = computed(() => {
    const status = this.request()?.status;
    return status !== undefined && CLOSED_REQUEST_STATUSES.has(status);
  });
  readonly canRequest = computed(() => {
    const status = this.request()?.status;
    return (
      !this.myRequest.isLoading() &&
      (status === undefined || status === 'rejected' || status === 'cancelled')
    );
  });
  readonly isSending = signal(false);

  readonly headerBadge = computed(() => {
    const request = this.request();
    if (request?.status === 'pending') {
      return {
        label: translate('screens.tripDetail.solicitudPendiente'),
        kind: 'pending' as const,
      };
    }
    if (request?.status === 'accepted') {
      return { label: translate('screens.tripDetail.plazaConfirmada'), kind: 'accepted' as const };
    }
    const free = this.trip()?.freeSeats ?? 0;
    return {
      label: formatFreeSeats(free),
      kind: free === 1 ? ('pending' as const) : ('accepted' as const),
    };
  });

  protected readonly notFoundIcon = mapOutline;
  protected readonly carIcon = carOutline;
  protected readonly formatSeats = formatSeats;
  protected readonly vehicleName = vehicleDisplayName;
  protected readonly vehicleColor = (color: string | null) => this.colors.label(color);
  protected readonly vehicleSwatch = (color: string | null) => this.colors.swatch(color);

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

  // Tras la navegación (que limpia la franja del título), la vuelve a poner:
  // el effect pudo mostrarla antes y no se repite si nada cambia
  ionViewDidEnter(): void {
    this.isVisible.set(true);
    if (this.trip()) {
      this.headingContent.show(this.tripHeading());
    }
  }

  ionViewWillLeave(): void {
    this.isVisible.set(false);
  }

  async handleRequest(): Promise<void> {
    const trip = this.trip();
    if (!trip) {
      return;
    }
    await this.send(async () => {
      const search = this.searchState.search();
      const request = await this.seatRequests.request(
        trip.id,
        this.seats(),
        search ? toRequestPickup(search, trip) : undefined,
      );
      this.myRequest.set(request);
      await this.router.navigateByUrl(`/tabs/trips/requests/${request.id}`);
      // Si falla, el error llega al registro global; la plaza ya está pedida
      void this.permissionPrompts.offerPush('request');
    });
  }

  async handleCancel(): Promise<void> {
    const request = this.request();
    if (!request) {
      return;
    }
    const isConfirmed = await this.confirm.ask({
      header: translate('screens.tripDetail.cancelarSolicitud'),
      message: translate('screens.tripDetail.dejarasTenerEsteViaje', {
        value1: formatSeats(request.seats),
      }),
      confirmText: translate('screens.tripDetail.confirmarCancelacion'),
      cancelText: translate('screens.tripDetail.mantenerSolicitud'),
    });
    if (!isConfirmed) {
      return;
    }
    await this.send(async () => {
      this.myRequest.set(await this.seatRequests.cancel(request.id));
    });
  }

  private async send(action: () => Promise<void>): Promise<void> {
    this.isSending.set(true);
    try {
      await action();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSending.set(false);
    }
  }
}

function formatFreeSeats(seats: number): string {
  return seats === 1
    ? translate('screens.tripDetail.ultimaPlaza')
    : translate('screens.tripDetail.plazasLibres2', { seats });
}
