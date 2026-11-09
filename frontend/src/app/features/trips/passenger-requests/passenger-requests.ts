import { Component, computed, inject, input, resource } from '@angular/core';
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
import { Trip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { formatTime } from '../../matching/trip-results';
import { formatSeats } from '../driver-trip-card/driver-trip-card';
import {
  EMPTY_TEXTS,
  passengerRequestLabel,
  passengerTripTab,
  TripsTab,
} from '../my-trips/trip-tabs';
import { formatRoute } from '../my-trips/my-trips-summary';

export interface PassengerTrip {
  request: SeatRequest;
  trip: Trip;
}

interface PassengerDayGroup {
  day: string;
  items: PassengerTrip[];
}

function dayLabel(trip: Trip): string {
  return formatDateLabel(new Date(trip.departureAt).toLocaleDateString('sv-SE'));
}

// Las solicitudes del pasajero en una pestaña de Mis viajes, agrupadas por
// día. Cada tarjeta lleva a su detalle (donde se cancela) y dice el siguiente
// paso; en No realizados, el estado es el motivo
@Component({
  selector: 'app-passenger-requests',
  imports: [RouterLink, IonButton, IonCard, IonCardContent, IonIcon, IonRouterLink, IonSpinner],
  templateUrl: './passenger-requests.html',
  styleUrl: './passenger-requests.scss',
})
export class PassengerRequests {
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly trips = inject(TripsService);

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
  // El viaje en curso (su plaza confirmada): Mis viajes lo destaca arriba y
  // no se repite en Próximos
  readonly live = computed(
    () =>
      this.all().find(
        ({ request, trip }) => request.status === 'accepted' && trip.status === 'in_progress',
      ) ?? null,
  );
  private readonly byTab = computed(() => {
    const live = this.live();
    const groups: Record<TripsTab, PassengerTrip[]> = { upcoming: [], past: [], cancelled: [] };
    for (const item of this.all()) {
      if (item !== live) {
        groups[passengerTripTab(item.request, item.trip)].push(item);
      }
    }
    return groups;
  });
  // Las de la pestaña: las próximas, de la primera que sale a la última; las
  // demás, de la más reciente a la más antigua
  readonly tabItems = computed(() => {
    const items = [...this.byTab()[this.tab()]].sort((a, b) =>
      a.trip.departureAt.localeCompare(b.trip.departureAt),
    );
    return this.tab() === 'upcoming' ? items : items.reverse();
  });
  // Los días, en el orden de la pestaña
  readonly dayGroups = computed(() => {
    const groups = new Map<string, PassengerTrip[]>();
    for (const item of this.tabItems()) {
      const day = dayLabel(item.trip);
      groups.set(day, [...(groups.get(day) ?? []), item]);
    }
    return [...groups].map(([day, items]): PassengerDayGroup => ({ day, items }));
  });
  readonly upcomingCount = computed(() => this.byTab().upcoming.length);
  readonly pastTrips = computed(() =>
    this.byTab().past.map(({ trip }) => ({ ...trip, carsAvoided: 1 })),
  );

  protected readonly emptyTexts: Record<TripsTab, string> = {
    ...EMPTY_TEXTS,
    cancelled: 'Aquí verás los viajes que no se hayan realizado',
  };
  protected readonly emptyIcon = searchOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly formatSeats = formatSeats;

  protected time(trip: Trip): string {
    return formatTime(trip.departureAt);
  }

  // Lo que lee el lector de pantalla del enlace (cubre toda la tarjeta)
  protected linkLabel(item: PassengerTrip): string {
    const { trip } = item;
    return `Ver solicitud: ${dayLabel(trip)}, ${this.time(trip)}, ${this.route(trip)}, ${this.statusLabel(item)}`;
  }

  // Qué falta: «Esperando respuesta de Lucía», «Confirmada: te recoge a las
  // 08:10». Sin siguiente paso en las demás pestañas
  protected nextStep({ request, trip }: PassengerTrip): string | null {
    if (this.tab() !== 'upcoming') {
      return null;
    }
    const driverName = getFirstName(trip.driver.name);
    if (request.status === 'pending') {
      return `Esperando respuesta de ${driverName}`;
    }
    if (request.pickupAt) {
      return `Confirmada: te recoge a las ${formatTime(request.pickupAt)}`;
    }
    return `Confirmada: viajas con ${driverName}`;
  }

  protected route(trip: Trip): string {
    return formatRoute(trip);
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

  handleRetry(): void {
    this.items.reload();
  }
}
