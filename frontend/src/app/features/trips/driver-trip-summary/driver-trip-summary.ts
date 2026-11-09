import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonCard, IonCardContent } from '@ionic/angular';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { TRIP_STATUS_LABELS } from '../../../shared/utils/trip-status.util';
import { formatTime } from '../../matching/trip-results';

// Cuánto antes de la salida se puede iniciar (START_WINDOW_MIN del backend)
const START_WINDOW_MS = 10 * 60 * 1000;

// Un viaje del conductor en la lista de Mis viajes: cuándo, de dónde a dónde,
// su estado y las plazas. Toda la tarjeta lleva a su detalle (solicitudes,
// chat y cancelar) o, si está en curso, a la pantalla del viaje; el texto del
// enlace es la acción principal
@Component({
  selector: 'app-driver-trip-summary',
  imports: [RouterLink, IonCard, IonCardContent],
  templateUrl: './driver-trip-summary.html',
  styleUrl: './driver-trip-summary.scss',
})
export class DriverTripSummary {
  private readonly tracking = inject(DriverTrackingService);

  readonly trip = input.required<DriverTrip>();

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
  readonly route = computed(() => {
    const { originName, destinationName } = this.trip();
    return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
  });
  readonly statusLabel = computed(() => TRIP_STATUS_LABELS[this.trip().status]);
  readonly seatsLabel = computed(() => {
    const { availableSeats, offeredSeats } = this.trip();
    return `${availableSeats} de ${offeredSeats} libres`;
  });
  readonly action = computed(() => {
    const { status, departureAt } = this.trip();
    if (status === 'in_progress') {
      return 'Abrir viaje';
    }
    if (status === 'confirmed' && Date.now() >= Date.parse(departureAt) - START_WINDOW_MS) {
      return 'Iniciar viaje';
    }
    return status === 'published' || status === 'confirmed' ? 'Ver solicitudes' : 'Ver viaje';
  });

  constructor() {
    // Al volver a la app con un viaje en curso, su posición se sigue enviando
    effect(() => {
      if (this.isInProgress()) {
        this.tracking.start(this.trip().id);
      }
    });
  }
}
