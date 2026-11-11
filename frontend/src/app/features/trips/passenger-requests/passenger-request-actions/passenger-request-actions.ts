import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular';
import { alertCircleOutline, searchOutline, warningOutline } from 'ionicons/icons';
import { ApiError } from '../../../../core/models/api-error.model';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../../core/services/requests/seat-requests.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { TripChatLink } from '../../../../shared/components/ui/trip-chat-link/trip-chat-link';
import { toIsoDate } from '../../../../shared/utils/date.util';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { getFirstName } from '../../../matching/trip-driver/trip-driver';
import { formatTime } from '../../../matching/trip-results';
import { TripSearchStateService } from '../../../matching/trip-search-state.service';
import { PassengerIncidentModal } from '../passenger-incident-modal/passenger-incident-modal';

// Columna de 4 en el detalle de la solicitud del pasajero: «Acciones de tu
// solicitud» (chat, cancelar con lo que cuesta cancelar, desactivadas con su
// motivo cuando ya está cerrada y buscar otro viaje con prioridad). Las horas
// de la solicitud van en su progreso (PassengerProgress)
@Component({
  selector: 'app-passenger-request-actions',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    TripChatLink,
  ],
  templateUrl: './passenger-request-actions.html',
  styleUrl: './passenger-request-actions.scss',
})
export class PassengerRequestActions {
  private readonly requests = inject(SeatRequestsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);
  private readonly router = inject(Router);
  private readonly searchState = inject(TripSearchStateService);

  readonly request = input.required<SeatRequest>();
  readonly trip = input.required<Trip>();
  readonly cancelled = output<SeatRequest>();
  // En En curso el chat va en la tarjeta del conductor: aquí, no
  readonly showChat = input(true);
  // En En curso, la incidencia la pinta la pantalla en lugar de todo (sin
  // otra ventana): aquí solo se avisa de que se ha pulsado
  readonly inlineIncident = input(false);
  readonly incidentRequested = output<void>();

  readonly isCancelling = signal(false);
  private readonly now = signal(Date.now());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  readonly hasChat = computed(() => {
    const { status: requestStatus } = this.request();
    const { status: tripStatus } = this.trip();
    return (
      requestStatus === 'accepted' && (tripStatus === 'confirmed' || tripStatus === 'in_progress')
    );
  });

  readonly isTripInProgress = computed(
    () => this.request().status === 'accepted' && this.trip().status === 'in_progress',
  );

  readonly canCancel = computed(() => {
    const request = this.request();
    const trip = this.trip();
    if (request.status === 'pending') {
      return trip.status === 'published' || trip.status === 'confirmed';
    }
    return (
      request.status === 'accepted' &&
      trip.status !== 'in_progress' &&
      trip.status !== 'finished' &&
      trip.status !== 'cancelled'
    );
  });

  readonly cancelLabel = computed(() =>
    this.request().status === 'accepted' ? 'Cancelar mi plaza' : 'Cancelar solicitud',
  );

  readonly cancellationIsLate = computed(() => {
    if (this.request().status !== 'accepted' || !this.canCancel()) {
      return false;
    }
    const departureTime = new Date(this.trip().departureAt).getTime();
    return departureTime - this.now() < 30 * 60 * 1000;
  });

  // Lo que cuesta cancelar, antes del botón (si aún no es tardía): pendiente,
  // nada; con plaza, nada hasta 30 min antes de la salida
  readonly cancelCost = computed(() => {
    if (!this.canCancel() || this.cancellationIsLate()) {
      return null;
    }
    if (this.request().status !== 'accepted') {
      return 'Puedes cancelarla sin coste.';
    }
    const freeUntil = formatTime(
      new Date(new Date(this.trip().departureAt).getTime() - 30 * 60 * 1000).toISOString(),
    );
    return `Sin coste hasta las ${freeUntil} (30 min antes de la salida). Después contará como cancelación tardía: con 3 en 30 días, 7 días sin poder pedir plaza.`;
  });

  readonly closedReason = computed(() => {
    if (this.canCancel() || this.isTripInProgress()) {
      return null;
    }
    const request = this.request();
    const trip = this.trip();
    if (trip.status === 'cancelled') {
      return 'El conductor canceló este viaje.';
    }
    if (trip.status === 'finished') {
      return 'Este viaje ya terminó.';
    }
    switch (request.status) {
      case 'rejected':
        return request.rejectionReason === 'trip_full'
          ? 'El viaje completó todas sus plazas.'
          : 'El conductor no aceptó esta solicitud.';
      case 'expired':
        return 'Esta solicitud caducó antes de la salida.';
      case 'cancelled':
        return request.rejectionReason === 'no_show'
          ? 'Se canceló porque no te presentaste a tiempo.'
          : 'Ya cancelaste esta solicitud.';
      default:
        return null;
    }
  });

  readonly canSearchAnother = computed(() => {
    const status = this.request().status;
    return (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'expired' ||
      this.trip().status === 'cancelled'
    );
  });

  protected readonly alertIcon = alertCircleOutline;
  protected readonly searchIcon = searchOutline;
  protected readonly warningIcon = warningOutline;

  async handleCancel(): Promise<void> {
    const request = this.request();
    const trip = this.trip();
    if (!this.canCancel() || this.isCancelling()) {
      return;
    }
    const isAccepted = request.status === 'accepted';
    const isLate = this.cancellationIsLate();
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
      const updated = await this.requests.cancel(request.id);
      this.cancelled.emit(updated);
      void this.toast.showSuccess(isAccepted ? 'Plaza cancelada.' : 'Solicitud cancelada.');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isCancelling.set(false);
    }
  }

  async openIncidentModal(): Promise<void> {
    if (this.inlineIncident()) {
      this.incidentRequested.emit();
      return;
    }
    const modal = await this.modalController.create({
      component: PassengerIncidentModal,
      componentProps: { tripId: this.trip().id },
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
    const direction = request.direction ?? 'to-campus';
    const coordinates = request.pickupLocation?.coordinates ?? trip.origin.coordinates;
    const fallbackAddress =
      direction === 'from-campus' ? (trip.destinationName ?? '') : (trip.originName ?? '');
    const address = request.pickupName ?? fallbackAddress;
    const departureDate = new Date(trip.departureAt);
    const targetDate = departureDate.getTime() < Date.now() ? new Date() : departureDate;

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
      seats: request.seats,
    });
    void this.router.navigateByUrl('/tabs/search');
  }
}
