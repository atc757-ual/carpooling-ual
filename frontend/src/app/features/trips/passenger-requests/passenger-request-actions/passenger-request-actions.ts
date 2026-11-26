import { translate, TranslocoPipe } from '@jsverse/transloco';
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
import {
  checkmarkCircleOutline,
  documentTextOutline,
  informationCircleOutline,
  searchOutline,
  warningOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../../core/models/api-error.model';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { PlacesService } from '../../../../core/services/places/places.service';
import { SeatRequestsService } from '../../../../core/services/requests/seat-requests.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { RevealOnTouch } from '../../../../shared/directives/reveal-on-touch.directive';
import { getFirstName } from '../../../matching/trip-driver/trip-driver';
import { formatTime } from '../../../matching/trip-results';
import { TripSearchStateService } from '../../../matching/trip-search-state.service';
import { AfterTripReport, isAfterTripReportOpen } from '../../after-trip-report/after-trip-report';
import { PassengerIncidentModal } from '../passenger-incident-modal/passenger-incident-modal';
import {
  isRelocatable,
  nearestParking,
  toSearchFromRequest,
} from '../relocation-card/relocation-card';
import {
  freeCancellationUntil,
  isWithinLeadMinutes,
  PASSENGER_LATE_CANCELLATION_LEAD_MIN,
} from '../../late-cancellation';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

// Columna de 4 en el detalle de la solicitud del pasajero: «Acciones de tu
// solicitud» (chat, cancelar con lo que cuesta cancelar, desactivadas con su
// motivo cuando ya está cerrada y buscar otro viaje). Las horas
// de la solicitud van en su progreso (PassengerProgress)
@Component({
  selector: 'app-passenger-request-actions',
  imports: [
    AfterTripReport,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    RevealOnTouch,
    TranslocoPipe,
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
  private readonly places = inject(PlacesService);

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
  readonly isOpeningSearch = signal(false);
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

  readonly cancelLabel = localizedComputed(() =>
    this.request().status === 'accepted'
      ? translate('screens.passengerRequestActions.cancelarPlaza')
      : translate('screens.passengerRequestActions.cancelarSolicitud'),
  );

  readonly cancellationIsLate = computed(() => {
    if (this.request().status !== 'accepted' || !this.canCancel()) {
      return false;
    }
    return isWithinLeadMinutes(
      this.trip().departureAt,
      PASSENGER_LATE_CANCELLATION_LEAD_MIN,
      this.now(),
    );
  });

  // Lo que cuesta cancelar, antes del botón (si aún no es tardía): pendiente,
  // nada; con plaza, nada hasta 10 min antes de la salida
  readonly cancelCost = localizedComputed(() => {
    if (!this.canCancel() || this.cancellationIsLate()) {
      return null;
    }
    if (this.request().status !== 'accepted') {
      return translate('screens.passengerRequestActions.puedesCancelarlaSinCoste');
    }
    const freeUntil = formatTime(
      freeCancellationUntil(this.trip().departureAt, PASSENGER_LATE_CANCELLATION_LEAD_MIN),
    );
    return translate('screens.passengerRequestActions.sinCosteHastaMin', {
      freeUntil,
      PASSENGER_LATE_CANCELLATION_LEAD_MIN,
    });
  });

  readonly closedReason = localizedComputed(() => {
    if (this.canCancel() || this.isTripInProgress()) {
      return null;
    }
    const request = this.request();
    const trip = this.trip();
    if (trip.status === 'cancelled') {
      return translate('screens.passengerRequestActions.conductorCanceloEsteViaje');
    }
    if (trip.status === 'finished') {
      return translate('screens.passengerRequestActions.esteViajeYaTermino');
    }
    switch (request.status) {
      case 'rejected':
        return request.rejectionReason === 'trip_full'
          ? translate('screens.passengerRequestActions.viajeCompletoTodasSus')
          : translate('screens.passengerRequestActions.conductorAceptoEstaSolicitud');
      case 'expired':
        return translate('screens.passengerRequestActions.estaSolicitudCaducoAntes');
      case 'cancelled':
        return request.rejectionReason === 'no_show'
          ? translate('screens.passengerRequestActions.canceloPorqueTePresentaste')
          : translate('screens.passengerRequestActions.yaCancelasteEstaSolicitud');
      default:
        return null;
    }
  });

  // Viaje ya realizado con plaza: reportarlo bajo «Este viaje ya terminó»
  // ... y solo en los 7 días siguientes a terminar
  readonly canReportAfterTrip = computed(() => {
    const status = this.request().status;
    return isAfterTripReportOpen(this.trip()) && (status === 'accepted' || status === 'completed');
  });
  // El icono del aviso: hecho, o cualquier otro motivo de cierre
  readonly closedIcon = computed(() =>
    this.trip().status === 'finished' ? checkmarkCircleOutline : informationCircleOutline,
  );

  // Si el conductor canceló, la tarjeta de arriba ya le busca otro viaje
  readonly canSearchAnother = computed(() => {
    const status = this.request().status;
    if (isRelocatable(this.request(), Date.now())) {
      return false;
    }
    return (
      status === 'rejected' ||
      status === 'cancelled' ||
      status === 'expired' ||
      this.trip().status === 'cancelled'
    );
  });
  // Si hay algo que enseñar: reportar en curso, cancelar, el motivo del
  // cierre o buscar otro viaje
  readonly hasContent = computed(
    () =>
      this.isTripInProgress() ||
      this.canCancel() ||
      this.closedReason() !== null ||
      this.canSearchAnother(),
  );

  protected readonly formIcon = documentTextOutline;
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
    const header = isAccepted
      ? translate('screens.passengerRequestActions.cancelarPlazaConfirmada')
      : translate('screens.passengerRequestActions.cancelarSolicitud2');
    const confirmText = translate('screens.passengerRequestActions.confirmarCancelacion');
    let message: string;
    if (isAccepted) {
      message = isLate
        ? translate('screens.passengerRequestActions.faltanMenos10Minutos')
        : translate('screens.passengerRequestActions.plazaVolveraEstarDisponible');
    } else {
      message = translate('screens.passengerRequestActions.dejaraVerlaPuedesVolver', {
        value1: getFirstName(trip.driver.name),
      });
    }
    const confirmed = await this.confirm.ask({
      header,
      message,
      confirmText,
      cancelText: isAccepted
        ? translate('screens.passengerRequestActions.mantenerPlaza')
        : translate('screens.passengerRequestActions.mantenerSolicitud'),
    });
    if (!confirmed) {
      return;
    }
    this.isCancelling.set(true);
    try {
      const updated = await this.requests.cancel(request.id);
      this.cancelled.emit(updated);
      void this.toast.showSuccess(
        isAccepted
          ? translate('screens.passengerRequestActions.plazaCancelada')
          : translate('screens.passengerRequestActions.solicitudCancelada'),
      );
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
      // Tan alta como el formulario (hoja abajo en el móvil, ventana en escritorio)
      cssClass: 'info-dialog',
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.reported) {
      void this.toast.showSuccess(translate('screens.passengerRequestActions.incidentReported'));
      await this.router.navigateByUrl('/tabs/trips');
    }
  }

  // Buscar con la ruta, la hora y las plazas de esta solicitud y el parking
  // real del viaje (el más cercano a su punto del campus), para cambiarla en
  // Buscar si hace falta. Sin prioridad: esa solo la da RF-24 y la aplica la API
  async handleSearchAnother(): Promise<void> {
    this.isOpeningSearch.set(true);
    try {
      await this.places.loadParkings();
      const trip = this.trip();
      const request = this.request();
      const isToCampus = (request.direction ?? 'to-campus') === 'to-campus';
      const campus = isToCampus ? trip.destination : trip.origin;
      this.searchState.set(
        toSearchFromRequest(
          request,
          trip,
          nearestParking(this.places.parkings(), campus.coordinates),
        ),
      );
      await this.router.navigateByUrl('/tabs/search');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isOpeningSearch.set(false);
    }
  }
}
