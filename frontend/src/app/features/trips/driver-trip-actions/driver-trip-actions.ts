import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  ModalController,
} from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { locationOutline, warningOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';
import { finishTrip } from '../finish-trip.util';
import { withDeclarations } from '../with-declarations';

// Solo en estos se puede cancelar
const OPEN_STATUSES: ReadonlySet<TripStatus> = new Set(['published', 'confirmed']);
// Cuánto antes de la salida se puede iniciar (START_WINDOW_MIN del backend)
const START_WINDOW_MS = 10 * 60 * 1000;

// Antes de pedir el permiso del dispositivo al iniciar: se informa, no se pide
// un consentimiento (es parte del servicio, RGPD 6.1.b, como explica la
// Política de privacidad). En la app nativa sigue con la pantalla bloqueada
// (servicio en primer plano), y se dice antes de pedirla
const SHARE_MESSAGE =
  'Para iniciar el viaje hay que compartir tu ubicación: tus pasajeros verán dónde estás mientras dura y dejarás de compartirla al terminarlo. Es parte del servicio (lo explica la Política de privacidad): solo te pedimos el permiso del dispositivo.';
const SHARE_MESSAGE_NATIVE = `${SHARE_MESSAGE} Seguirá compartiéndose aunque bloquees la pantalla o uses otra app; lo verás en una notificación.`;

// RF-21: al iniciar se confirma la declaración, sin otra casilla
const DECLARATION_MESSAGE =
  'Al iniciar, confirmas que sigues cumpliendo tu declaración y la de tu vehículo (permiso, seguro e ITV).';

// «Qué puedes hacer» en el detalle de un viaje del conductor: iniciarlo
// (desde 10 min antes de la salida, con el viaje confirmado), abrirlo y
// terminarlo mientras está en curso (su posición se comparte con
// DriverTrackingService) y cancelarlo mientras sigue abierto. Avisa con
// «changed» al iniciar, terminar o cancelar
@Component({
  selector: 'app-driver-trip-actions',
  imports: [IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonIcon, RouterLink],
  templateUrl: './driver-trip-actions.html',
  styleUrl: './driver-trip-actions.scss',
})
export class DriverTripActions {
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  private readonly tracking = inject(DriverTrackingService);
  private readonly location = inject(LocationService);
  private readonly router = inject(Router);
  private readonly modalController = inject(ModalController);

  readonly trip = input.required<DriverTrip>();
  readonly changed = output<void>();

  readonly isOpen = computed(() => OPEN_STATUSES.has(this.trip().status));
  readonly isCancelling = signal(false);

  // Iniciar: con el viaje confirmado y desde 10 min antes de la salida. La
  // hora se revisa cada minuto para activar el botón sin recargar
  private readonly now = signal(Date.now());
  readonly isInProgress = computed(() => this.trip().status === 'in_progress');
  // La pantalla del viaje en curso
  readonly livePath = computed(() => `/tabs/trips/drive/${this.trip().id}`);
  private readonly startableAt = computed(
    () => new Date(this.trip().departureAt).getTime() - START_WINDOW_MS,
  );
  readonly canStart = computed(
    () => this.trip().status === 'confirmed' && this.now() >= this.startableAt(),
  );
  // Una sola línea bajo «Iniciar viaje», solo si aún no se puede: «Disponible
  // desde las 08:50» o, publicado, hasta que alguien tenga plaza. Lo que
  // supone iniciarlo lo explica la confirmación
  readonly startHint = computed(() => {
    const { status } = this.trip();
    if (status === 'published') {
      return 'Disponible cuando aceptes a algún pasajero';
    }
    return status === 'confirmed' && !this.canStart()
      ? `Disponible desde las ${formatTime(new Date(this.startableAt()).toISOString())}`
      : null;
  });
  // Cancelado o terminado: las acciones, desactivadas, con el motivo
  readonly closedReason = computed(() => {
    switch (this.trip().status) {
      case 'cancelled':
        return 'Este viaje se canceló: ya no se puede iniciar ni cancelar.';
      case 'finished':
        return 'Este viaje ya terminó.';
      default:
        return null;
    }
  });
  readonly isChangingStatus = signal(false);
  protected readonly locationIcon = locationOutline;
  protected readonly warningIcon = warningOutline;

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

  // Con pasajeros (confirmado) y a menos de 30 min de la salida: el aviso
  // aparece solo entonces (la hora se revisa cada minuto)
  readonly cancellationIsLate = computed(() => {
    const trip = this.trip();
    return (
      trip.status === 'confirmed' &&
      new Date(trip.departureAt).getTime() - this.now() < 30 * 60 * 1000
    );
  });

  async handleStart(): Promise<void> {
    const trip = this.trip();
    if (!this.canStart() || !(await this.ensureLocationShared())) {
      return;
    }
    this.isChangingStatus.set(true);
    try {
      // Si a una declaración le toca renovarse (cada año), se acepta antes
      await withDeclarations(
        { driver: this.driver, modalController: this.modalController },
        trip.vehicleId,
        () => this.driver.startTrip(trip.id),
      );
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
    const hasPermission = (await this.location.checkDevicePermission()) === 'granted';
    const shareMessage = Capacitor.isNativePlatform() ? SHARE_MESSAGE_NATIVE : SHARE_MESSAGE;
    const accepted = await this.confirm.ask({
      header: hasPermission ? '¿Iniciar el viaje?' : 'Compartirás tu ubicación',
      message: hasPermission ? DECLARATION_MESSAGE : `${shareMessage} ${DECLARATION_MESSAGE}`,
      confirmText: 'Iniciar viaje',
      cancelText: 'Ahora no',
      icon: this.locationIcon,
    });
    if (!accepted || hasPermission) {
      return accepted;
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
