import { Component, computed, inject, input, output, resource, signal } from '@angular/core';
import { IonButton, IonCard, IonCardContent, IonSpinner } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest, SeatRequestStatus } from '../../../core/models/seat-request.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';

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
};
// Solo en estos se piden y deciden plazas
const OPEN_STATUSES: ReadonlySet<TripStatus> = new Set(['published', 'confirmed']);

export function formatSeats(seats: number): string {
  return seats === 1 ? '1 plaza' : `${seats} plazas`;
}

// Un viaje del conductor en Mis viajes: cuándo sale, de dónde a dónde, su
// estado y sus plazas libres y, si sigue abierto, sus solicitudes (las
// prioritarias primero) con «Aceptar» y «Rechazar» en las pendientes. Avisa
// con «changed» al decidir una, porque cambian las plazas y quizá el estado
@Component({
  selector: 'app-driver-trip-card',
  imports: [IonButton, IonCard, IonCardContent, IonSpinner],
  templateUrl: './driver-trip-card.html',
  styleUrl: './driver-trip-card.scss',
})
export class DriverTripCard {
  private readonly driver = inject(DriverService);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

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
