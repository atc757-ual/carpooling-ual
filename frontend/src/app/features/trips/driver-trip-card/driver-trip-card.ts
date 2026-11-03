import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  resource,
  signal,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonCard, IonCardContent, IonIcon, IonSpinner } from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { locationOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest, SeatRequestStatus } from '../../../core/models/seat-request.model';
import { TravelPreferencesStore } from '../../../core/services/catalogs/travel-preferences.store';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripChatLink } from '../../../shared/components/ui/trip-chat-link/trip-chat-link';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';
import { finishTrip } from '../finish-trip.util';

// El estado en texto (guía, «Estados»: nunca solo con color)
const TRIP_STATUS_LABELS: Record<TripStatus, string> = {
  published: 'Publicado',
  confirmed: 'Confirmado',
  in_progress: 'En curso',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
};
const REQUEST_STATUS_LABELS: Record<SeatRequestStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  rejected: 'No aceptada',
  cancelled: 'Cancelada',
  expired: 'Caducada',
};
// Solo en estos se piden y deciden plazas
const OPEN_STATUSES: ReadonlySet<TripStatus> = new Set(['published', 'confirmed']);
const CHAT_STATUSES: ReadonlySet<TripStatus> = new Set(['confirmed', 'in_progress']);
// Cuánto antes de la salida se puede iniciar (START_WINDOW_MIN del backend)
const START_WINDOW_MS = 10 * 60 * 1000;

// Antes de pedir el permiso del dispositivo al iniciar: se informa, no se pide
// un consentimiento (es parte del servicio, RGPD 6.1.b, como explica la
// Política de privacidad). En la app nativa sigue con la pantalla bloqueada
// (servicio en primer plano), y se dice antes de pedirla
const SHARE_MESSAGE =
  'Para iniciar el viaje hay que compartir tu ubicación: tus pasajeros verán dónde estás mientras dura y dejarás de compartirla al terminarlo. Es parte del servicio (lo explica la Política de privacidad): solo te pedimos el permiso del dispositivo.';
const SHARE_MESSAGE_NATIVE = `${SHARE_MESSAGE} Seguirá compartiéndose aunque bloquees la pantalla o uses otra app; lo verás en una notificación.`;

export function formatSeats(seats: number): string {
  return seats === 1 ? '1 plaza' : `${seats} plazas`;
}

// Un viaje del conductor en Mis viajes: cuándo sale, de dónde a dónde, su
// estado y sus plazas libres y, si sigue abierto, sus solicitudes (las
// prioritarias primero) con «Aceptar» y «Rechazar» en las pendientes. Avisa
// con «changed» al decidir una, porque cambian las plazas y quizá el estado,
// y al iniciar o terminar el viaje (mientras está en curso se comparte la
// posición del conductor con DriverTrackingService)
@Component({
  selector: 'app-driver-trip-card',
  imports: [IonButton, IonCard, IonCardContent, IonIcon, IonSpinner, RouterLink, TripChatLink],
  templateUrl: './driver-trip-card.html',
  styleUrl: './driver-trip-card.scss',
})
export class DriverTripCard {
  private readonly travelPreferences = inject(TravelPreferencesStore);
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly tracking = inject(DriverTrackingService);
  private readonly location = inject(LocationService);
  private readonly router = inject(Router);

  readonly trip = input.required<DriverTrip>();
  readonly changed = output<void>();

  readonly isOpen = computed(() => OPEN_STATUSES.has(this.trip().status));
  // «Hoy · 07:40», «jue, 30 oct · 07:40»
  readonly when = computed(() => {
    const departureAt = new Date(this.trip().departureAt);
    const day = departureAt.toLocaleDateString('sv-SE');
    return `${formatDateLabel(day)} · ${formatTime(this.trip().departureAt)}`;
  });
  readonly route = computed(() => {
    const { originName, destinationName } = this.trip();
    return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
  });
  readonly statusLabel = computed(() => TRIP_STATUS_LABELS[this.trip().status]);
  readonly seatsLabel = computed(() => {
    const { availableSeats, offeredSeats } = this.trip();
    return `${availableSeats} de ${offeredSeats} libres`;
  });

  // Las solicitudes, solo de los viajes abiertos
  readonly requests = resource({
    params: () => (this.isOpen() ? this.trip().id : undefined),
    loader: ({ params: tripId }) => this.driver.listTripRequests(tripId),
  });
  readonly visibleRequests = computed(() =>
    (this.requests.hasValue() ? this.requests.value() : []).filter(
      ({ status }) => status === 'pending' || status === 'accepted',
    ),
  );
  // La solicitud que se está decidiendo
  readonly deciding = signal<string | null>(null);
  readonly isCancelling = signal(false);

  protected readonly formatSeats = formatSeats;

  // Iniciar: con el viaje confirmado y desde 10 min antes de la salida. La
  // hora se revisa cada minuto para activar el botón sin recargar
  private readonly now = signal(Date.now());
  readonly isInProgress = computed(() => this.trip().status === 'in_progress');
  // El chat existe desde que hay pasajeros aceptados (confirmado) y en curso
  readonly hasChat = computed(() => CHAT_STATUSES.has(this.trip().status));
  // La pantalla del viaje en curso
  readonly livePath = computed(() => `/tabs/trips/drive/${this.trip().id}`);
  private readonly startableAt = computed(
    () => new Date(this.trip().departureAt).getTime() - START_WINDOW_MS,
  );
  readonly canStart = computed(
    () => this.trip().status === 'confirmed' && this.now() >= this.startableAt(),
  );
  // «Podrás iniciarlo desde las 08:50»
  readonly startHint = computed(() =>
    this.trip().status === 'confirmed' && !this.canStart()
      ? `Podrás iniciarlo desde las ${formatTime(new Date(this.startableAt()).toISOString())}`
      : null,
  );
  readonly isChangingStatus = signal(false);
  protected readonly locationIcon = locationOutline;

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
    // Si el viaje sigue en curso, su posición se sigue enviando
    effect(() => {
      if (this.isInProgress()) {
        this.tracking.start(this.trip().id);
      }
    });
  }

  readonly cancellationIsLate = computed(() => {
    const trip = this.trip();
    return (
      trip.status === 'confirmed' &&
      new Date(trip.departureAt).getTime() - Date.now() < 30 * 60 * 1000
    );
  });

  protected requestLabel(status: SeatRequestStatus): string {
    return REQUEST_STATUS_LABELS[status];
  }

  protected passengerPreferences(request: SeatRequest): string[] {
    return this.travelPreferences.format(request.passenger.preferences);
  }

  async handleDecide(request: SeatRequest, decision: 'accept' | 'reject'): Promise<void> {
    this.deciding.set(request.id);
    try {
      await this.driver.decideRequest(request.id, decision);
      const verb = decision === 'accept' ? 'aceptado' : 'rechazado';
      void this.toast.showSuccess(`Has ${verb} la solicitud de ${request.passenger.name}.`);
      this.requests.reload();
      this.changed.emit();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.deciding.set(null);
    }
  }

  async handleStart(): Promise<void> {
    const trip = this.trip();
    if (!this.canStart() || !(await this.ensureLocationShared())) {
      return;
    }
    this.isChangingStatus.set(true);
    try {
      await this.driver.startTrip(trip.id);
      this.tracking.start(trip.id);
      void this.toast.showSuccess('Viaje iniciado. Tus pasajeros ya ven dónde estás.');
      this.changed.emit();
      // Directo a la pantalla del viaje en curso
      void this.router.navigateByUrl(this.livePath());
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isChangingStatus.set(false);
    }
  }

  async handleFinish(): Promise<void> {
    this.isChangingStatus.set(true);
    const deps = {
      confirm: this.confirm,
      driver: this.driver,
      tracking: this.tracking,
      toast: this.toast,
      location: this.location,
    };
    if (await finishTrip(deps, this.trip(), this.locationIcon)) {
      this.changed.emit();
    }
    this.isChangingStatus.set(false);
  }

  // Para iniciar el viaje hay que compartir la ubicación. No es un
  // consentimiento (no se registra): si el dispositivo aún no da permiso, se
  // explica y se pide el permiso. false si no se da
  private async ensureLocationShared(): Promise<boolean> {
    if ((await this.location.checkDevicePermission()) === 'granted') {
      return true;
    }
    const accepted = await this.confirm.ask({
      header: 'Compartirás tu ubicación',
      message: Capacitor.isNativePlatform() ? SHARE_MESSAGE_NATIVE : SHARE_MESSAGE,
      confirmText: 'Iniciar viaje',
      cancelText: 'Ahora no',
      icon: this.locationIcon,
    });
    if (!accepted) {
      return false;
    }
    try {
      await this.location.getCurrentPoint('driving');
      return true;
    } catch (error) {
      const message =
        error instanceof LocationError
          ? 'Sin permiso de ubicación no puedes iniciar el viaje. Actívalo en los ajustes del móvil.'
          : getErrorMessage(ApiError.fromHttpError(error));
      void this.toast.showError(message);
      return false;
    }
  }

  async handleCancel(): Promise<void> {
    const trip = this.trip();
    if (!this.isOpen()) {
      return;
    }
    const isLate = this.cancellationIsLate();
    const message = isLate
      ? 'La salida está a menos de 30 minutos (o ya pasó) y hay pasajeros aceptados. Esta cancelación contará como tardía y puede suspender tus publicaciones al llegar a 3 en 30 días. Avisaremos a los pasajeros.'
      : 'Se avisará a los pasajeros y dejarán de tener sus plazas. Puedes publicar otro viaje cuando quieras.';
    const accepted = await this.confirm.ask({
      header: '¿Cancelar este viaje?',
      message,
      confirmText: 'Cancelar viaje',
      cancelText: 'Mantener viaje',
      isDestructive: true,
    });
    if (!accepted) {
      return;
    }
    this.isCancelling.set(true);
    try {
      await this.driver.cancelTrip(trip.id);
      void this.toast.showSuccess('Viaje cancelado. Hemos avisado a los pasajeros.');
      this.changed.emit();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isCancelling.set(false);
    }
  }
}
