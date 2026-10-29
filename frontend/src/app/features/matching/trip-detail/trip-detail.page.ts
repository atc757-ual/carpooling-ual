import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonRouterLink,
  IonSpinner,
} from '@ionic/angular';
import { carOutline, mapOutline } from 'ionicons/icons';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import { ApiError } from '../../../core/models/api-error.model';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatShortDate, toTripDetail } from '../trip-results';
import { getFirstName, TripDriver } from '../trip-driver/trip-driver';
import { TripSearchStateService } from '../trip-search-state.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';

// Detalle de un viaje de los resultados de Buscar: el recorrido con sus horas,
// quien conduce (y su coche, cuando se conozca) y cómo funciona la solicitud.
// Sale de los resultados de la búsqueda (TripSearchStateService); si el viaje
// no está entre ellos (p. ej. tras recargar la página), «No encontramos este
// viaje». Al lado, pedir plaza (RF-08) y, si ya la ha pedido, el estado de
// su solicitud tal como lo da el backend (guía, «Solicitud de plaza»)
@Component({
  selector: 'app-trip-detail',
  imports: [
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonRouterLink,
    IonSpinner,
    RouteTimeline,
    TripDriver,
  ],
  templateUrl: './trip-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-detail.page.scss'],
})
export class TripDetailPage {
  private readonly searchState = inject(TripSearchStateService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  // :id de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  readonly trip = computed(() => {
    const search = this.searchState.search();
    const result = this.searchState.results().find(({ id }) => id === this.id());
    return search && result ? toTripDetail(result, search) : null;
  });

  // «27 oct, ida al campus»
  readonly tripDate = computed(() => {
    const trip = this.trip();
    if (!trip) {
      return '';
    }
    const way = trip.direction === 'to-campus' ? 'ida al campus' : 'vuelta del campus';
    return `${formatShortDate(trip.date)}, ${way}`;
  });

  readonly stops = computed<RouteStop[]>(() => {
    const trip = this.trip();
    if (!trip) {
      return [];
    }
    return [
      { name: trip.origin, detail: trip.originDetail, time: trip.departureTime },
      { name: trip.destination, detail: trip.destinationDetail, time: trip.arrivalTime },
    ];
  });

  readonly driverFirstName = computed(() => {
    const trip = this.trip();
    return trip ? getFirstName(trip.driver.name) : '';
  });

  // Las plazas que pide el pasajero, las de su búsqueda
  readonly seats = computed(() => this.searchState.search()?.seats ?? 1);
  readonly requestedSeats = computed(() => formatSeats(this.seats()));

  // Su solicitud en este viaje (la más reciente), o null si no tiene
  readonly myRequest = resource({
    params: () => this.trip()?.id,
    loader: async ({ params: tripId }) =>
      (await this.seatRequests.listMine()).find(({ trip }) => trip.id === tripId) ?? null,
  });
  readonly request = computed(() => (this.myRequest.hasValue() ? this.myRequest.value() : null));
  // Se puede pedir sin solicitud, o con una rechazada o cancelada
  readonly canRequest = computed(() => {
    const status = this.request()?.status;
    return (
      !this.myRequest.isLoading() &&
      (status === undefined || status === 'rejected' || status === 'cancelled')
    );
  });
  readonly isSending = signal(false);

  protected readonly carIcon = carOutline;
  protected readonly notFoundIcon = mapOutline;
  protected readonly formatSeats = formatSeats;

  // RF-08: pedir las plazas de la búsqueda. Queda pendiente hasta que el
  // conductor decide
  async handleRequest(): Promise<void> {
    const trip = this.trip();
    if (!trip) {
      return;
    }
    await this.send(async () => {
      this.myRequest.set(await this.seatRequests.request(trip.id, this.seats()));
    });
  }

  // Cancelar la solicitud, tras confirmarlo (acción destructiva)
  async handleCancel(): Promise<void> {
    const request = this.request();
    if (!request) {
      return;
    }
    const isConfirmed = await this.confirm.ask({
      header: '¿Cancelar tu solicitud?',
      message: `Dejarás de tener ${formatSeats(request.seats)} en este viaje. Podrás volver a pedirla mientras queden plazas.`,
      confirmText: 'Cancelar solicitud',
      cancelText: 'Mantener solicitud',
      isDestructive: true,
    });
    if (!isConfirmed) {
      return;
    }
    await this.send(async () => {
      this.myRequest.set(await this.seatRequests.cancel(request.id));
    });
  }

  private async send(action: () => Promise<void>): Promise<void> {
    this.isSending.set(true);
    try {
      await action();
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isSending.set(false);
    }
  }
}

// «1 plaza», «2 plazas»
function formatSeats(seats: number): string {
  return seats === 1 ? '1 plaza' : `${seats} plazas`;
}
