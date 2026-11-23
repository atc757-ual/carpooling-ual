import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { IonButton, IonCard, IonCardContent, IonIcon, IonSpinner } from '@ionic/angular';
import { flashOutline } from 'ionicons/icons';
import { ApiError } from '../../../../core/models/api-error.model';
import { Trip } from '../../../../core/models/driver.model';
import { CampusParking } from '../../../../core/models/place.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { TripSearch } from '../../../../core/models/trip-search.model';
import { PlacesService } from '../../../../core/services/places/places.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { toIsoDate } from '../../../../shared/utils/date.util';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { formatTime } from '../../../matching/trip-results';
import { TripSearchStateService } from '../../../matching/trip-search-state.service';

// Los demás viajes, con el margen más amplio de Buscar (como en la API)
const RELOCATION_MARGIN_MIN = 20;
// La tarjeta se ofrece durante los 30 min siguientes a la cancelación
export const RELOCATION_WINDOW_MS = 30 * 60_000;

// Solicitud cancelada porque el conductor canceló el viaje (la API la marca
// con este motivo), en los 30 min siguientes
export function isRelocatable(request: SeatRequest, nowMs: number): boolean {
  return (
    request.status === 'cancelled' &&
    request.rejectionReason === 'trip_cancelled' &&
    !!request.cancelledAt &&
    nowMs - Date.parse(request.cancelledAt) <= RELOCATION_WINDOW_MS
  );
}

// El parking del campus del viaje: el más cercano a su destino al ir (a su
// origen al volver)
export function nearestParking(
  parkings: readonly CampusParking[],
  [lon, lat]: [number, number],
): CampusParking | null {
  let nearest: CampusParking | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (const parking of parkings) {
    const [parkingLon, parkingLat] = parking.location.coordinates;
    const distance = (parkingLon - lon) ** 2 + (parkingLat - lat) ** 2;
    if (distance < best) {
      best = distance;
      nearest = parking;
    }
  }
  return nearest;
}

// La búsqueda equivalente al viaje de una solicitud (su punto, su parking, su
// hora y sus plazas). Con el parking real del viaje: el que dé nearestParking
export function toSearchFromRequest(
  request: SeatRequest,
  trip: Trip,
  parking: CampusParking | null,
): TripSearch {
  const direction = request.direction ?? 'to-campus';
  const isToCampus = direction === 'to-campus';
  const departure = new Date(trip.departureAt);
  const date = departure.getTime() < Date.now() ? new Date() : departure;
  return {
    direction,
    place: {
      id: 'relocation-place',
      name: request.pickupName ?? (isToCampus ? trip.originName : trip.destinationName) ?? '',
      locality: 'Almería',
      coordinates: request.pickupLocation?.coordinates ?? trip.origin.coordinates,
    },
    parking: parking
      ? { id: parking.id, name: parking.name }
      : { id: '', name: translate('request.relocation.campus') },
    date: toIsoDate(date),
    // La API compara salidas (±20 min de la del viaje cancelado)
    time: formatTime(trip.departureAt),
    margin: RELOCATION_MARGIN_MIN,
    seats: request.seats,
  };
}

// La misma búsqueda, marcada con la solicitud cuando el conductor canceló:
// Buscar enseña sus opciones con el viaje que encaja al 100 % arriba
export function toRelocationSearch(
  request: SeatRequest,
  trip: Trip,
  parking: CampusParking | null,
): TripSearch {
  return { ...toSearchFromRequest(request, trip, parking), relocationRequestId: request.id };
}

// Tarjeta de arriba del detalle cuando el conductor cancela (30 min): lleva
// a Buscar con los viajes como el suyo y el que encaja al 100 % destacado.
// La plaza la pide él (22/11/2026)
@Component({
  selector: 'app-relocation-card',
  imports: [IonCard, IonCardContent, IonButton, IonIcon, IonSpinner, TranslocoPipe],
  templateUrl: './relocation-card.html',
  styleUrl: './relocation-card.scss',
})
export class RelocationCard {
  private readonly places = inject(PlacesService);
  private readonly searchState = inject(TripSearchStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly request = input.required<SeatRequest>();
  readonly trip = input.required<Trip>();
  // El reloj de la pantalla (avanza cada 30 s)
  readonly now = input.required<number>();

  // Minutos que le quedan para usarla (al menos 1 mientras se ve)
  readonly minutesLeft = computed(() => {
    const cancelledAt = this.request().cancelledAt;
    const endsAt = (cancelledAt ? Date.parse(cancelledAt) : this.now()) + RELOCATION_WINDOW_MS;
    return Math.max(1, Math.ceil((endsAt - this.now()) / 60_000));
  });

  // Rayo: «ahora», distinto de la lupa de Buscar
  protected readonly priorityIcon = flashOutline;
  readonly isOpening = signal(false);

  async handleSearch(): Promise<void> {
    this.isOpening.set(true);
    try {
      await this.places.loadParkings();
      const trip = this.trip();
      const request = this.request();
      const isToCampus = (request.direction ?? 'to-campus') === 'to-campus';
      const campus = isToCampus ? trip.destination : trip.origin;
      this.searchState.set(
        toRelocationSearch(
          request,
          trip,
          nearestParking(this.places.parkings(), campus.coordinates),
        ),
      );
      await this.router.navigateByUrl('/tabs/search/results');
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isOpening.set(false);
    }
  }
}
