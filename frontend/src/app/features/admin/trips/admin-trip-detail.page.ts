import { Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  IonBreadcrumb,
  IonBreadcrumbs,
  IonButton,
  IonCard,
  IonIcon,
  IonSkeletonText,
} from '@ionic/angular';
import {
  carOutline,
  ellipseOutline,
  handRightOutline,
  locationOutline,
  mapOutline,
  timeOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminTripsService } from '../../../core/services/admin/admin-trips.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import {
  RoutePoint,
  TripRouteMap,
} from '../../../shared/components/ui/trip-route-map/trip-route-map';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { eventTypeLabel } from '../digital-twin/event-labels';
import {
  formatDateTime,
  requestStatusLabel,
  tripRoute,
  tripStatusLabel,
} from '../users/admin-user-detail-labels';
import { requestsLabel, routeSummaryLabel, seatsLabel, tripStatusClass } from './admin-trip-labels';

const TRIPS_PATH = '/admin/trips';
const USERS_PATH = '/admin/users';
const NO_NAME = 'Cuenta eliminada';

// Detalle de un viaje en el panel, solo lectura: sus datos, sus solicitudes
// (las prioritarias primero) y la línea de tiempo de sus eventos
@Component({
  selector: 'app-admin-trip-detail-page',
  imports: [
    HeadingContent,
    IonBreadcrumb,
    IonBreadcrumbs,
    IonButton,
    IonCard,
    IonIcon,
    IonSkeletonText,
    RouterLink,
    TripRouteMap,
  ],
  templateUrl: './admin-trip-detail.page.html',
  styleUrl: './admin-trip-detail.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTripDetailPage {
  private readonly adminTrips = inject(AdminTripsService);
  private readonly trips = inject(TripsService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  // Parámetro de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  readonly detail = resource({
    params: () => this.id(),
    loader: ({ params }) => this.adminTrips.get(params),
  });

  readonly trip = computed(() => {
    if (!this.detail.hasValue()) {
      return null;
    }
    const trip = this.detail.value();
    return {
      route: tripRoute(trip),
      origin: trip.originName ?? 'Origen',
      destination: trip.destinationName ?? 'Destino',
      departure: formatDateTime(trip.departureAt),
      status: tripStatusLabel(trip.status),
      statusClass: tripStatusClass(trip.status),
      driver: { name: trip.driver.name ?? NO_NAME, link: [USERS_PATH, trip.driver.id] },
      seats: seatsLabel(trip),
      requests: requestsLabel(trip),
      seatRequests: trip.seatRequests.map((request) => ({
        id: request.id,
        passenger: request.passenger.name ?? NO_NAME,
        passengerLink: [USERS_PATH, request.passenger.id],
        status: requestStatusLabel(request.status),
        seats: request.seats === 1 ? '1 plaza' : `${request.seats} plazas`,
        isPriority: request.isPriority,
        pickup: pickupLabel(request.pickupName, request.pickupAt),
      })),
      timeline: trip.timeline.map((event) => ({
        id: event.id,
        label: eventTypeLabel(event.type),
        time: formatDateTime(event.occurredAt),
        occurredAt: event.occurredAt,
      })),
    };
  });
  readonly error = computed(() => {
    const error = this.detail.error();
    return error ? ApiError.fromHttpError(error) : null;
  });
  readonly isNotFound = computed(() => this.error()?.code === 'TRIP_NOT_FOUND');
  readonly errorMessage = computed(() => {
    const error = this.error();
    return error ? getErrorMessage(error) : null;
  });

  // La ruta por carretera (OSRM), aparte: si falla, el resto se ve igual
  readonly routeData = resource({
    params: () => this.id(),
    loader: ({ params }) => this.trips.getRoute(params),
  });
  // El mapa con la salida y el destino (los extremos de la ruta) y el resumen
  readonly routeMap = computed(() => {
    if (!this.routeData.hasValue()) {
      return null;
    }
    const route = this.routeData.value();
    const points = route.geometry.coordinates;
    if (points.length < 2) {
      return null;
    }
    const trip = this.trip();
    const origin: RoutePoint = { coordinates: points[0], label: trip?.origin ?? 'Salida' };
    const destination: RoutePoint = {
      coordinates: points[points.length - 1],
      label: trip?.destination ?? 'Destino',
    };
    return {
      route,
      origin,
      destination,
      summary: routeSummaryLabel(route),
      isEstimated: route.source === 'estimated',
    };
  });

  protected readonly icons = {
    trip: carOutline,
    origin: ellipseOutline,
    destination: locationOutline,
    requests: handRightOutline,
    timeline: timeOutline,
    route: mapOutline,
  };
  protected readonly tripsPath = TRIPS_PATH;

  // Volver a la lista con sus filtros (si se llegó desde ella), desde la
  // cabecera móvil o desde la ruta (que lleva el enlace, pero no lo sigue)
  async handleBack(event?: Event): Promise<void> {
    event?.preventDefault();
    if (this.router.lastSuccessfulNavigation()?.previousNavigation) {
      this.location.back();
      return;
    }
    await this.router.navigateByUrl(TRIPS_PATH);
  }

  handleRetry(): void {
    this.detail.reload();
  }
}

// «Recogida: Avenida del Mediterráneo · 2 nov, 08:12»; sin punto, nada
function pickupLabel(name: string | null, at: string | null): string | null {
  if (name === null) {
    return null;
  }
  return at === null ? `Recogida: ${name}` : `Recogida: ${name} · ${formatDateTime(at)}`;
}
