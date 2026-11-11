import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonRouterLink,
  IonSelect,
  IonSelectOption,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, createOutline, searchOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { TripResult } from '../../../core/models/trip-result.model';
import { TripDirection, TripSearch } from '../../../core/models/trip-search.model';
import { MatchingService } from '../../../core/services/matching/matching.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatSeats } from '../../../shared/utils/seats.util';
import { CAMPUS_NAME } from '../campus';
import { TripResultCard } from '../trip-result-card/trip-result-card';
import { getMatchFit, MatchFit } from '../match-fit';
import { toSearchRequest, toTripResult } from '../trip-results';
import { MARGINS } from '../trip-search';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { TripSearchStateService } from '../trip-search-state.service';

type SearchSortOrder = 'arrival' | 'detour';

const ACTIVE_REQUEST_STATUSES = new Set(['pending', 'accepted']);

// «3 viajes llegan entre 08:45 y 09:15»; al volver del campus, «salen»
export function describeResults(trips: TripResult[], direction: TripDirection): string {
  const isToCampus = direction === 'to-campus';
  const times = trips
    .map((trip) => (isToCampus ? trip.arrivalTime : trip.departureTime))
    .sort((left, right) => left.localeCompare(right));
  const first = times[0];
  const last = times.at(-1);
  if (times.length === 1) {
    return `1 viaje ${isToCampus ? 'llega' : 'sale'} a las ${first}`;
  }
  const verb = isToCampus ? 'llegan' : 'salen';
  const when = first === last ? `a las ${first}` : `entre ${first} y ${last}`;
  return `${times.length} viajes ${verb} ${when}`;
}

// «Tu búsqueda»: los viajes que encajan con la búsqueda hecha en Buscar. En
// escritorio, 8 + 4 a todo el ancho: resultados en la de 8 y «Tu trayecto»
// (con los datos en fila y el aviso de horas estimadas) en la de 4
@Component({
  selector: 'app-search-results',
  imports: [
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonRouterLink,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    ModalHeader,
    RouteTimeline,
    TripResultCard,
    TripSearchForm,
  ],
  templateUrl: './search-results.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './search-results.page.scss'],
})
export class SearchResultsPage {
  private readonly searchState = inject(TripSearchStateService);
  private readonly matching = inject(MatchingService);
  private readonly seatRequests = inject(SeatRequestsService);

  readonly search = this.searchState.search;

  readonly results = resource({
    params: () => this.search() ?? undefined,
    loader: async ({ params }) =>
      (await this.matching.search(toSearchRequest(params))).map((match) =>
        toTripResult(match, params),
      ),
  });

  private readonly foundTrips = computed(() =>
    this.results.hasValue() ? this.results.value() : [],
  );
  // Los viajes en que ya pediste plaza están en Tus viajes: aquí no se
  // repiten (se avisa de cuántos con un enlace)
  readonly trips = computed(() =>
    this.foundTrips().filter(({ id }) => !this.requestedTripIds().has(id)),
  );
  readonly requestedCount = computed(() => this.foundTrips().length - this.trips().length);
  private readonly myRequests = resource({ loader: () => this.seatRequests.listMine() });
  readonly requestedTripIds = computed(
    () =>
      new Set(
        (this.myRequests.hasValue() ? this.myRequests.value() : [])
          .filter((request) => ACTIVE_REQUEST_STATUSES.has(request.status))
          .map((request) => request.trip.id),
      ),
  );
  readonly resultsSummary = computed(() =>
    describeResults(this.trips(), this.search()?.direction ?? 'to-campus'),
  );
  // Cómo encaja cada viaje con la búsqueda: el color de su fila
  fitOf(trip: TripResult): MatchFit {
    const search = this.search();
    return search ? getMatchFit(trip, search) : 'fair';
  }

  readonly bestTripId = computed(() => (this.trips().length > 1 ? this.trips()[0].id : null));
  readonly sortOrder = signal<SearchSortOrder>('arrival');
  readonly sortedTrips = computed(() => {
    const trips = [...this.trips()];
    if (this.sortOrder() === 'detour') {
      return trips.sort(
        (left, right) =>
          left.pickupDetourMinutes - right.pickupDetourMinutes ||
          Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt),
      );
    }
    return trips.sort((left, right) => Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt));
  });
  readonly errorMessage = computed(() => {
    const error = this.results.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : '';
  });
  readonly widerMargin = computed(() => {
    const margin = this.search()?.margin ?? 0;
    return MARGINS.find((value) => value > margin) ?? null;
  });

  readonly stops = computed<RouteStop[]>(() => {
    const search = this.search();
    if (!search) {
      return [];
    }
    const place = { name: search.place.name, detail: search.place.locality };
    const campus = { name: CAMPUS_NAME, detail: search.parking.name };
    return search.direction === 'to-campus' ? [place, campus] : [campus, place];
  });

  // «Mañana · llegada 08:00 ± 15 min · 1 plaza»
  readonly details = computed(() => {
    const search = this.search();
    if (!search) {
      return '';
    }
    const time = search.direction === 'to-campus' ? 'llegada' : 'salida';
    return `${formatDateLabel(search.date)} · ${time} ${search.time} ± ${search.margin} min · ${formatSeats(search.seats)}`;
  });

  readonly searchFacts = computed(() => {
    const search = this.search();
    if (!search) {
      return [];
    }
    const timeLabel = search.direction === 'to-campus' ? 'Llegada' : 'Salida';
    return [
      { label: 'Día', value: formatDateLabel(search.date) },
      { label: timeLabel, value: `${search.time} ± ${search.margin} min` },
      { label: 'Plazas', value: formatSeats(search.seats) },
    ];
  });

  readonly isEditing = signal(false);

  protected readonly editIcon = createOutline;
  protected readonly emptyIcon = searchOutline;
  protected readonly errorIcon = alertCircleOutline;

  constructor() {
    effect(() => this.searchState.setResults(this.trips()));
  }

  ionViewWillEnter(): void {
    this.myRequests.reload();
  }

  handleWidenMargin(): void {
    const search = this.search();
    const margin = this.widerMargin();
    if (search && margin) {
      this.searchState.set({ ...search, margin } satisfies TripSearch);
    }
  }

  handleRetry(): void {
    this.results.reload();
  }

  handleSortChange(value: string | number | undefined): void {
    if (value === 'arrival' || value === 'detour') {
      this.sortOrder.set(value);
    }
  }
}
