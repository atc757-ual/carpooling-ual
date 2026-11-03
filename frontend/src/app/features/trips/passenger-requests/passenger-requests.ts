import { Component, computed, inject, input, resource, signal } from '@angular/core';
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
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatTime } from '../../matching/trip-results';
import { formatSeats } from '../driver-trip-card/driver-trip-card';
import {
  EMPTY_TEXTS,
  passengerRequestLabel,
  passengerTripTab,
  TripsTab,
} from '../my-trips/trip-tabs';
import { ConfirmService } from '../../../core/services/ui/confirm.service';

export interface PassengerTrip {
  request: SeatRequest;
  trip: Trip;
}

// Las solicitudes del pasajero en una pestaña de Mis viajes, cada una con su
// viaje (cuándo, de dónde a dónde y quién conduce) y su estado (en
// Cancelados, con el motivo). Las pendientes y las confirmadas de viajes que
// aún no han salido se pueden cancelar (con confirmación)
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
  readonly tab = input<TripsTab>('upcoming');
  private readonly all = computed(() => (this.items.hasValue() ? this.items.value() : []));
  // Las de la pestaña: las próximas, de la primera que sale a la última; las
  // demás, de la más reciente a la más antigua
  readonly tabItems = computed(() => {
    const items = this.all()
      .filter(({ request, trip }) => passengerTripTab(request, trip) === this.tab())
      .sort((a, b) => a.trip.departureAt.localeCompare(b.trip.departureAt));
    return this.tab() === 'upcoming' ? items : items.reverse();
  });
  readonly cancelling = signal<string | null>(null);

  protected readonly emptyTexts = EMPTY_TEXTS;
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

  protected statusLabel({ request, trip }: PassengerTrip): string {
    return passengerRequestLabel(request, trip);
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
