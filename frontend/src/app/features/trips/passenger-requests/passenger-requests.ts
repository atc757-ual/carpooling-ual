import { Component, computed, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonIcon,
  IonRouterLink,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, searchOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest, SeatRequestStatus } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';
import { formatSeats } from '../driver-trip-card/driver-trip-card';
import { ConfirmService } from '../../../core/services/ui/confirm.service';

// El estado en texto, con el vocabulario de la guía para el pasajero
const STATUS_LABELS: Record<SeatRequestStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Confirmada',
  rejected: 'No aceptada',
  cancelled: 'Cancelada',
};

export interface PassengerTrip {
  request: SeatRequest;
  trip: Trip;
}

// Las solicitudes del pasajero en Mis viajes, cada una con su viaje (cuándo,
// de dónde a dónde y quién conduce) y su estado tal como lo da el backend.
// Primero las de viajes que aún no han terminado; las pendientes se pueden
// cancelar (con confirmación)
@Component({
  selector: 'app-passenger-requests',
  imports: [RouterLink, IonButton, IonCard, IonCardContent, IonIcon, IonRouterLink, IonSpinner],
  templateUrl: './passenger-requests.html',
  styleUrl: './passenger-requests.scss',
})
export class PassengerRequests {
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  // Cada solicitud con su viaje (uno por solicitud: un pasajero tiene pocas)
  readonly items = resource({
    loader: async (): Promise<PassengerTrip[]> => {
      const requests = await this.seatRequests.listMine();
      return Promise.all(
        requests.map(async (request) => ({
          request,
          trip: await this.trips.getTrip(request.trip.id),
        })),
      );
    },
  });
  private readonly all = computed(() => (this.items.hasValue() ? this.items.value() : []));
  readonly upcoming = computed(() => this.all().filter(({ trip }) => isUpcoming(trip)));
  readonly past = computed(() => this.all().filter(({ trip }) => !isUpcoming(trip)));
  readonly cancelling = signal<string | null>(null);

  protected readonly emptyIcon = searchOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly formatSeats = formatSeats;

  // «Mañana · 07:40»
  protected when(trip: Trip): string {
    const departureAt = new Date(trip.departureAt);
    return `${formatDateLabel(departureAt.toLocaleDateString('sv-SE'))} · ${formatTime(trip.departureAt)}`;
  }

  protected route(trip: Trip): string {
    return `${trip.originName ?? 'Origen'} → ${trip.destinationName ?? 'Destino'}`;
  }

  // «Conduce Lucía Cortés · 2 plazas · Matrícula 1234BCD» (la matrícula, al confirmarla)
  protected details({ request, trip }: PassengerTrip): string {
    const parts = [`Conduce ${trip.driver.name}`, formatSeats(request.seats)];
    if (request.vehiclePlate) {
      parts.push(`Matrícula ${request.vehiclePlate}`);
    }
    return parts.join(' · ');
  }

  protected statusLabel(status: SeatRequestStatus): string {
    return STATUS_LABELS[status];
  }

  // Pendiente o confirmada, en un viaje que aún no ha salido
  protected canCancel({ request, trip }: PassengerTrip): boolean {
    const isActive = request.status === 'pending' || request.status === 'accepted';
    return isActive && (trip.status === 'published' || trip.status === 'confirmed');
  }

  handleRetry(): void {
    this.items.reload();
  }

  // Cancelar una solicitud pendiente o confirmada, tras confirmarlo
  async handleCancel({ request, trip }: PassengerTrip): Promise<void> {
    const isConfirmed = await this.confirm.ask({
      header: '¿Cancelar tu solicitud?',
      message: `Dejarás de tener ${formatSeats(request.seats)} en el viaje de ${trip.driver.name}.`,
      confirmText: 'Cancelar solicitud',
      cancelText: 'Mantener solicitud',
      isDestructive: true,
    });
    if (!isConfirmed) {
      return;
    }
    this.cancelling.set(request.id);
    try {
      await this.seatRequests.cancel(request.id);
      this.items.reload();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.cancelling.set(null);
    }
  }
}

function isUpcoming({ status }: Trip): boolean {
  return status === 'published' || status === 'confirmed' || status === 'in_progress';
}
