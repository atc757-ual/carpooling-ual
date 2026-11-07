import { Component, computed, effect, inject, input, resource, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { alertCircleOutline, callOutline, searchOutline, sparklesOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { ChatContact } from '../../../core/models/chat.model';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { TripDriver } from '../../../core/models/trip-result.model';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripChatLink } from '../../../shared/components/ui/trip-chat-link/trip-chat-link';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { RouteStop } from '../../../shared/components/ui/route-timeline/route-timeline';
import {
  TripSummary as TripSummaryComponent,
  TripSummaryData,
} from '../../../shared/components/ui/trip-summary';
import { toIsoDate } from '../../../shared/utils/date.util';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { TripSearchStateService } from '../../matching/trip-search-state.service';
import { formatTime } from '../../matching/trip-results';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatSeats } from '../driver-trip-card/driver-trip-card';
import { TripProgress } from '../trip-progress/trip-progress';
import { LiveTripMap } from './live-trip-map/live-trip-map';
import { PassengerIncidentModal } from './passenger-incident-modal/passenger-incident-modal';

interface HistoryEntry {
  label: string;
  at: string;
}

const HISTORY_DATE_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function historyAnsweredLabel(request: SeatRequest): string {
  if (request.status === 'accepted') {
    return 'Solicitud aceptada';
  }
  if (request.status === 'expired') {
    return 'Solicitud caducada';
  }
  if (request.rejectionReason === 'trip_full') {
    return 'Viaje completo';
  }
  return 'Solicitud rechazada';
}

// Detalle compartido por Tus viajes, Avisos y el flujo de solicitud desde Buscar.
@Component({
  selector: 'app-passenger-request-detail',
  imports: [
    RouterLink,
    TripChatLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSpinner,
    TripSummaryComponent,
    TripProgress,
    LiveTripMap,
  ],
  templateUrl: './passenger-request-detail.page.html',
  styleUrl: './passenger-request-detail.page.scss',
})
export class PassengerRequestDetailPage {
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly requests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly tripCall = inject(TripCallService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);
  private readonly searchState = inject(TripSearchStateService);

  readonly id = input.required<string>();
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
  readonly summary = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return request && trip ? this.toSummary(request, trip) : null;
  });
  readonly history = computed(() => {
    const request = this.request();
    if (!request) {
      return [];
    }
    const entries: HistoryEntry[] = [{ label: 'Solicitud enviada', at: request.requestedAt }];
    if (request.answeredAt) {
      entries.push({
        label: historyAnsweredLabel(request),
        at: request.answeredAt,
      });
    }
    if (request.boardedAt) {
      entries.push({ label: 'Subida al vehículo validada', at: request.boardedAt });
    }
    if (request.cancelledAt) {
      const label =
        request.rejectionReason === 'no_show'
          ? 'Cancelada por no presentarse'
          : 'Solicitud cancelada';
      entries.push({ label, at: request.cancelledAt });
    }
    return entries;
  });

  readonly isCancelling = signal(false);
  readonly isPageVisible = signal(true);

  readonly contacts = signal<ChatContact[]>([]);
  readonly driverContact = computed(() => {
    return this.contacts().find((c) => c.role === 'driver') ?? null;
  });

  protected readonly alertIcon = alertCircleOutline;
  protected readonly callIcon = callOutline;
  protected readonly sparklesIcon = sparklesOutline;
  protected readonly searchIcon = searchOutline;

  readonly canCancel = computed(() => {
    const request = this.request();
    const trip = this.trip();
    if (!request || !trip) {
      return false;
    }
    if (request.status === 'pending') {
      return true;
    }
    if (
      request.status === 'accepted' &&
      trip.status !== 'in_progress' &&
      trip.status !== 'finished' &&
      trip.status !== 'cancelled'
    ) {
      return true;
    }
    return false;
  });

  readonly isTripInProgress = computed(() => {
    const request = this.request();
    const trip = this.trip();
    return request?.status === 'accepted' && trip?.status === 'in_progress';
  });

  constructor() {
    effect(() => {
      const tripId = this.trip()?.id;
      const isAccepted = this.request()?.status === 'accepted';
      if (tripId && isAccepted) {
        void this.loadContacts(tripId);
      } else {
        this.contacts.set([]);
      }
    });
  }

  private async loadContacts(tripId: string): Promise<void> {
    const contacts = await this.tripCall.loadContacts(tripId);
    this.contacts.set(contacts);
  }

  canCallDriver(): boolean {
    const trip = this.trip();
    return this.tripCall.canCall(trip?.status, this.driverContact());
  }

  callDriverLabel(): string {
    const trip = this.trip();
    const name = trip ? this.firstName(trip.driver.name) : '';
    return this.tripCall.callLabel(this.driverContact(), name);
  }

  handleCallDriver(): void {
    const trip = this.trip();
    this.tripCall.call(this.driverContact(), trip?.status);
  }

  ionViewWillEnter(): void {
    this.isPageVisible.set(true);
  }

  ionViewDidLeave(): void {
    this.isPageVisible.set(false);
  }

  protected pickupLocation(request: SeatRequest, trip: Trip) {
    if (request.pickupLocation) {
      return request.pickupLocation;
    }
    return request.direction === 'from-campus' ? trip.origin : null;
  }

  protected pickupName(request: SeatRequest, trip: Trip): string {
    return (
      request.pickupName ??
      (request.direction === 'from-campus' ? trip.originName : 'Tu punto de recogida') ??
      'Tu punto de recogida'
    );
  }

  protected readonly formatDateTime = (value: string) =>
    HISTORY_DATE_FORMAT.format(new Date(value));
  protected readonly formatSeats = formatSeats;
  protected readonly firstName = (name: string) => getFirstName(name);
  protected readonly directionLabel = (request: SeatRequest) => {
    if (request.direction === 'to-campus') {
      return 'Ida al campus';
    }
    if (request.direction === 'from-campus') {
      return 'Vuelta del campus';
    }
    return 'Viaje';
  };

  protected when(trip: Trip): string {
    const date = new Date(trip.departureAt).toLocaleDateString('sv-SE');
    return `${formatDateLabel(date)} · ${formatTime(trip.departureAt)}`;
  }

  async handleCancel(): Promise<void> {
    const request = this.request();
    const trip = this.trip();
    if (!request || !trip || !this.canCancel() || this.isCancelling()) {
      return;
    }

    const isAccepted = request.status === 'accepted';
    let isLate = false;
    if (isAccepted) {
      const departureTime = new Date(trip.departureAt).getTime();
      const minutesToDeparture = Math.floor((departureTime - Date.now()) / 60000);
      isLate = minutesToDeparture < 30;
    }

    const header = isAccepted ? '¿Cancelar tu plaza confirmada?' : '¿Cancelar la solicitud?';
    const confirmText = isAccepted ? 'Cancelar mi plaza' : 'Cancelar solicitud';

    let message: string;
    if (isAccepted) {
      message = isLate
        ? 'Faltan menos de 30 minutos para la salida. La plaza quedará libre para otra persona, pero contará como cancelación tardía.'
        : 'La plaza volverá a estar disponible para otra persona. Puedes buscar otro viaje cuando quieras.';
    } else {
      message = `${getFirstName(trip.driver.name)} dejará de verla. Puedes volver a solicitar si sigue habiendo plazas.`;
    }

    const confirmed = await this.confirm.ask({
      header,
      message,
      confirmText,
      cancelText: 'Mantener',
      isDestructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.isCancelling.set(true);
    try {
      this.requestOverride.set(await this.requests.cancel(request.id));
      void this.toast.showSuccess(isAccepted ? 'Plaza cancelada.' : 'Solicitud cancelada.');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isCancelling.set(false);
    }
  }

  async openIncidentModal(): Promise<void> {
    const trip = this.trip();
    if (!trip) {
      return;
    }
    const modal = await this.modalController.create({
      component: PassengerIncidentModal,
      componentProps: { tripId: trip.id },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.reported) {
      void this.toast.showSuccess('Incidencia registrada. Tu plaza ha sido cancelada.');
      await this.router.navigateByUrl('/tabs/trips');
    }
  }

  handlePrioritySearch(): void {
    const trip = this.trip();
    const request = this.request();
    if (trip) {
      const direction = request?.direction ?? 'to-campus';
      const coordinates = request?.pickupLocation?.coordinates ?? trip.origin.coordinates;
      const fallbackAddress =
        direction === 'from-campus' ? (trip.destinationName ?? '') : (trip.originName ?? '');
      const address = request?.pickupName ?? fallbackAddress;

      const departureDate = new Date(trip.departureAt);
      const isPast = departureDate.getTime() < Date.now();
      const targetDate = isPast ? new Date() : departureDate;

      this.searchState.set({
        direction,
        place: {
          id: 'priority-place',
          name: address || 'Almería',
          locality: 'Almería',
          coordinates,
        },
        parking: { id: 'p1', name: 'Parking Central' },
        date: toIsoDate(targetDate),
        time: formatTime(trip.departureAt),
        margin: 20,
        seats: request?.seats ?? 1,
      });
    }
    void this.router.navigateByUrl('/tabs/search');
  }

  private toSummary(request: SeatRequest, trip: Trip): TripSummaryData {
    const stops: RouteStop[] = [
      {
        name: trip.originName ?? 'Salida del conductor',
        detail: 'Salida del conductor',
        time: formatTime(trip.departureAt),
      },
    ];
    if (request.direction) {
      const pickupAt = request.pickupAt ?? trip.departureAt;
      stops.push({
        name:
          request.pickupName ??
          (request.direction === 'from-campus' ? trip.originName : 'Tu punto de recogida') ??
          'Tu punto de recogida',
        detail: 'Tu punto de recogida',
        time: formatTime(pickupAt),
      });
    }
    stops.push({
      name: trip.destinationName ?? 'Destino del viaje',
      detail: 'Destino',
    });
    const driver: TripDriver = {
      name: trip.driver.name,
      avatarKey: trip.driver.avatarKey,
      tripCount: trip.driver.tripCount,
      rating: trip.driver.rating ?? undefined,
      // En esta app solo las cuentas con correo UAL verificado pueden viajar.
      isEmailVerified: true,
    };
    return {
      stops,
      driver,
      vehicle: trip.vehicle,
      seatSummary: `Quedan ${trip.availableSeats} de ${trip.offeredSeats} plazas`,
      vehiclePlate: request.status === 'accepted' ? request.vehiclePlate : null,
      preferences: this.travelPreferences.format(trip.driver.preferences),
    };
  }
}
