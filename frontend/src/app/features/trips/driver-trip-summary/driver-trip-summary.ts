import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon, IonItem, IonLabel, IonRouterLink } from '@ionic/angular';
import { carOutline } from 'ionicons/icons';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { tripStatusLabel } from '../../../shared/utils/trip-status.util';
import { formatTime } from '../../matching/trip-results';
import { tripWayOf } from '../trip-way';

// Cuánto antes de la salida se puede iniciar (START_WINDOW_MIN del backend)
const START_WINDOW_MS = 10 * 60 * 1000;

// Un viaje del conductor en la lista de Mis viajes: cuándo, de dónde a dónde,
// su estado y las plazas. Toda la tarjeta lleva a su detalle (solicitudes,
// chat y cancelar) o, si está en curso, a la pantalla del viaje; abajo, la
// acción principal
@Component({
  selector: 'app-driver-trip-summary',
  imports: [RouterLink, IonRouterLink, IonItem, IonLabel, IonIcon, TranslocoPipe],
  templateUrl: './driver-trip-summary.html',
  styleUrl: './driver-trip-summary.scss',
})
export class DriverTripSummary {
  private readonly tracking = inject(DriverTrackingService);

  readonly trip = input.required<DriverTrip>();
  readonly pendingCount = input(0);

  // «2 solicitudes por responder»
  readonly pendingLabel = computed(() => {
    const count = this.pendingCount();
    if (count === 0) {
      return null;
    }
    return count === 1
      ? translate('screens.driverTripSummary.oneRequest')
      : translate('screens.driverTripSummary.solicitudesResponder', { count });
  });

  readonly isInProgress = computed(() => this.trip().status === 'in_progress');
  readonly link = computed(() =>
    this.isInProgress()
      ? `/tabs/trips/drive/${this.trip().id}`
      : `/tabs/trips/published/${this.trip().id}`,
  );
  readonly when = computed(() => {
    const { departureAt } = this.trip();
    const day = new Date(departureAt).toLocaleDateString('sv-SE');
    return `${formatDateLabel(day)} · ${formatTime(departureAt)}`;
  });
  // En la tarjeta, solo la hora: el día va en el título de su grupo
  readonly time = computed(() => formatTime(this.trip().departureAt));
  readonly route = computed(() => {
    const { originName, destinationName } = this.trip();
    return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
  });
  readonly statusLabel = computed(() => tripStatusLabel(this.trip().status));
  readonly seatsLabel = computed(() => {
    const { availableSeats, offeredSeats } = this.trip();
    return translate('screens.driverTripSummary.freeOf', {
      available: availableSeats,
      offered: offeredSeats,
    });
  });
  // Lo que lee el lector de pantalla del enlace (toda la tarjeta)
  readonly linkLabel = computed(() =>
    translate('screens.driverTripSummary.linkLabel', {
      action: this.action(),
      when: this.when(),
      route: this.route(),
    }),
  );
  readonly action = computed(() => {
    const { status, departureAt } = this.trip();
    if (status === 'in_progress') {
      return translate('screens.driverTripSummary.abrirViaje');
    }
    if (status === 'confirmed' && Date.now() >= Date.parse(departureAt) - START_WINDOW_MS) {
      return translate('screens.driverTripSummary.iniciarViaje');
    }
    return status === 'published' || status === 'confirmed'
      ? translate('screens.driverTripSummary.verSolicitudes')
      : translate('screens.driverTripSummary.verViaje');
  });

  constructor() {
    // Al volver a la app con un viaje en curso, su posición se sigue enviando
    effect(() => {
      if (this.isInProgress()) {
        this.tracking.start(this.trip().id);
      }
    });
  }

  protected readonly roleIcon = carOutline;
  // «Ida al campus» o «Vuelta a casa», encima del trayecto
  readonly way = computed(() => tripWayOf(this.trip()));
}
