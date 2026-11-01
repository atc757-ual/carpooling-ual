import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonContent, IonSpinner } from '@ionic/angular';
import {
  TripSummary as TripSummaryComponent,
  TripSummaryData,
} from '../../../shared/components/ui/trip-summary';
import { ApiError } from '../../../core/models/api-error.model';
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { TripDriver } from '../../../core/models/trip-result.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { formatTravelPreferences } from '../../../core/models/travel-preferences.model';
import { RouteStop } from '../../../shared/components/ui/route-timeline/route-timeline';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { formatTime } from '../../matching/trip-results';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatSeats } from '../driver-trip-card/driver-trip-card';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { LiveTripMap } from './live-trip-map/live-trip-map';

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

// Detalle compartido por Tus viajes, Avisos y el flujo de solicitud desde Buscar.
@Component({
  selector: 'app-passenger-request-detail',
  imports: [
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonSpinner,
    TripSummaryComponent,
    LiveTripMap,
  ],
  templateUrl: './passenger-request-detail.page.html',
  styleUrl: './passenger-request-detail.page.scss',
})
export class PassengerRequestDetailPage {
  private readonly requests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

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
        label: request.status === 'accepted' ? 'Solicitud aceptada' : 'Solicitud respondida',
        at: request.answeredAt,
      });
    }
    if (request.cancelledAt) {
      entries.push({ label: 'Solicitud cancelada', at: request.cancelledAt });
    }
    return entries;
  });
  readonly isCancelling = signal(false);
  readonly isPageVisible = signal(true);

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
    if (!request || !trip || request.status !== 'pending' || this.isCancelling()) {
      return;
    }
    const confirmed = await this.confirm.ask({
      header: '¿Cancelar la solicitud?',
      message: `${getFirstName(trip.driver.name)} dejará de verla. Puedes volver a solicitar si sigue habiendo plazas.`,
      confirmText: 'Cancelar solicitud',
      cancelText: 'Mantener',
      isDestructive: true,
    });
    if (!confirmed) {
      return;
    }
    this.isCancelling.set(true);
    try {
      this.requestOverride.set(await this.requests.cancel(request.id));
      void this.toast.showSuccess('Solicitud cancelada.');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isCancelling.set(false);
    }
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
      preferences: formatTravelPreferences(trip.driver.preferences),
    };
  }
}
