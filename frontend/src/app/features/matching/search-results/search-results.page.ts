import { translate, TranslocoPipe } from '@jsverse/transloco';
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
  IonList,
  IonModal,
  IonRouterLink,
  IonSelect,
  IonSelectOption,
} from '@ionic/angular';
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
  createOutline,
  searchOutline,
} from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { TripMatch } from '../../../core/models/trip-match.model';
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
import { PreferenceFilters } from '../preference-filters/preference-filters';
import {
  driverPreferencesOf,
  filterByPreferences,
  matchesPreferences,
  PreferenceFilter,
} from '../preference-filters/preference-filter';
import { AuthService } from '../../../core/services/auth/auth.service';
import { getMatchFit, MatchFit } from '../match-fit';
import { toSearchRequest, toTripResult } from '../trip-results';
import { MARGINS } from '../trip-search';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { TripSearchStateService } from '../trip-search-state.service';
import { EmptyState } from '../../../shared/components/ui/empty-state/empty-state';
import { LoadingState } from '../../../shared/components/ui/loading-state/loading-state';
import { localizedComputed } from '../../../core/i18n/localized-computed';

type SearchSortOrder = 'arrival' | 'detour';

// Los viajes encontrados. Tras la cancelación del conductor, arriba y aparte
// el que encaja al 100 % o, si no hay, los que encajan con su horario; en
// trips, los demás de ese día
interface FoundTrips {
  exact: TripResult | null;
  priority: TripResult[];
  trips: TripResult[];
}

// Qué se encontró al buscar otro viaje: uno al 100 %, alguno a su hora o
// ninguno (cada caso con su aviso)
export type RelocationOutcome = 'exact' | 'onTime' | 'none';

const ACTIVE_REQUEST_STATUSES = new Set(['pending', 'accepted']);

// «3 viajes llegan a destino entre 08:45 y 09:15»; al volver del campus, «salen»
export function describeResults(trips: TripResult[], direction: TripDirection): string {
  const isToCampus = direction === 'to-campus';
  const times = trips
    .map((trip) => (isToCampus ? trip.arrivalTime : trip.departureTime))
    .sort((left, right) => left.localeCompare(right));
  const first = times[0];
  const last = times.at(-1);
  const base = `screens.searchResults.${isToCampus ? 'arrive' : 'depart'}`;
  if (times.length === 1) {
    return translate(`${base}.one`, { time: first });
  }
  return first === last
    ? translate(`${base}.at`, { count: times.length, time: first })
    : translate(`${base}.between`, { count: times.length, first, last });
}

export function timeWindowText(trips: TripResult[], direction: TripDirection): string {
  if (trips.length === 0) return '';
  const isToCampus = direction === 'to-campus';
  const times = trips
    .map((trip) => (isToCampus ? trip.arrivalTime : trip.departureTime))
    .sort((left, right) => left.localeCompare(right));
  const first = times[0];
  const last = times.at(-1);
  const base = `screens.searchResults.${isToCampus ? 'arriveWindow' : 'departWindow'}`;
  if (trips.length === 1) {
    return translate(`${base}.one`, { time: first });
  }
  return first === last
    ? translate(`${base}.at`, { time: first })
    : translate(`${base}.between`, { first, last });
}

// «Tu búsqueda»: los viajes que encajan con la búsqueda hecha en Buscar. En
// escritorio, 8 + 4 a todo el ancho: resultados en la de 8 y «Tu trayecto»
// (con los datos en fila y el aviso de horas estimadas) en la de 4
@Component({
  selector: 'app-search-results',
  imports: [
    EmptyState,
    LoadingState,
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonList,
    IonModal,
    IonRouterLink,
    IonSelect,
    IonSelectOption,
    ModalHeader,
    RouteTimeline,
    TripResultCard,
    PreferenceFilters,
    TripSearchForm,
    TranslocoPipe,
  ],
  templateUrl: './search-results.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './search-results.page.scss'],
})
export class SearchResultsPage {
  private readonly searchState = inject(TripSearchStateService);
  private readonly matching = inject(MatchingService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly auth = inject(AuthService);

  readonly search = this.searchState.search;

  readonly results = resource({
    params: () => this.search() ?? undefined,
    loader: ({ params }) => this.loadResults(params),
  });

  // Tras la cancelación del conductor, los resultados son las opciones de su
  // solicitud: arriba, con su aviso, el viaje al 100 % o los que encajan con
  // su horario; debajo, los demás de ese día
  readonly isRelocation = computed(() => Boolean(this.search()?.relocationRequestId));
  readonly exactTrip = computed(() => {
    const exact = this.results.hasValue() ? this.results.value().exact : null;
    return exact && !this.requestedTripIds().has(exact.id) ? exact : null;
  });
  readonly priorityTrips = computed(() =>
    (this.results.hasValue() ? this.results.value().priority : []).filter(
      ({ id }) => !this.requestedTripIds().has(id),
    ),
  );
  readonly relocationOutcome = computed<RelocationOutcome>(() => {
    if (this.exactTrip()) {
      return 'exact';
    }
    return this.priorityTrips().length > 0 ? 'onTime' : 'none';
  });
  private readonly foundTrips = computed(() =>
    this.results.hasValue() ? this.results.value().trips : [],
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
  readonly resultsSummary = localizedComputed(() =>
    describeResults(this.trips(), this.search()?.direction ?? 'to-campus'),
  );
  // Con filtros, «3 de 7 viajes»
  readonly resultsCountLabel = localizedComputed(() => {
    const count = this.trips().length;
    if (this.hasFilters()) {
      return translate(
        count === 1 ? 'screens.searchResults.shownOf.one' : 'screens.searchResults.shownOf.other',
        { shown: this.filteredTrips().length, count },
      );
    }
    return translate(
      count === 1 ? 'screens.searchResults.found.one' : 'screens.searchResults.found.other',
      { count },
    );
  });
  readonly resultsTimeWindow = localizedComputed(() =>
    timeWindowText(this.trips(), this.search()?.direction ?? 'to-campus'),
  );
  // Cómo encaja cada viaje con la búsqueda: el color de su fila
  fitOf(trip: TripResult): MatchFit {
    const search = this.search();
    return search ? getMatchFit(trip, search) : 'fair';
  }

  // Al buscar otro viaje, lo mejor ya va destacado arriba: abajo no hay
  // «Mejor coincidencia»
  readonly bestTripId = computed(() =>
    this.trips().length > 0 && !this.isRelocation() ? this.trips()[0].id : null,
  );
  readonly sortOrder = signal<SearchSortOrder>('detour');
  // Filtros por las preferencias del conductor (solo en la lista; el
  // matching no cambia) y la etiqueta «Coincide con tus preferencias»
  readonly preferenceFilters = signal<ReadonlySet<PreferenceFilter>>(new Set());
  readonly filteredTrips = computed(() =>
    filterByPreferences(this.trips(), this.preferenceFilters()),
  );
  readonly hasFilters = computed(() => this.preferenceFilters().size > 0);
  private readonly myPreferences = computed(() => this.auth.currentUser()?.preferences);
  readonly sortedTrips = computed(() => {
    const trips = [...this.filteredTrips()];
    if (this.sortOrder() === 'detour') {
      return trips.sort(
        (left, right) =>
          left.pickupDetourMinutes - right.pickupDetourMinutes ||
          Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt),
      );
    }
    return trips.sort((left, right) => Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt));
  });
  readonly errorMessage = localizedComputed(() => {
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
  readonly details = localizedComputed(() => {
    const search = this.search();
    if (!search) {
      return '';
    }
    const time = translate(
      search.direction === 'to-campus'
        ? 'searchResults.details.arrival'
        : 'searchResults.details.departure',
    );
    return `${formatDateLabel(search.date)} · ${time} ${search.time} ± ${search.margin} min · ${formatSeats(search.seats)}`;
  });

  readonly searchFacts = localizedComputed(() => {
    const search = this.search();
    if (!search) {
      return [];
    }
    const timeLabel = translate(
      search.direction === 'to-campus'
        ? 'searchResults.facts.arrival'
        : 'searchResults.facts.departure',
    );
    return [
      { label: translate('screens.searchResults.dia'), value: formatDateLabel(search.date) },
      { label: timeLabel, value: `${search.time} ± ${search.margin} min` },
      { label: translate('searchResults.facts.seats'), value: formatSeats(search.seats) },
    ];
  });

  readonly isEditing = signal(false);

  protected readonly editIcon = createOutline;
  protected readonly emptyIcon = searchOutline;
  protected readonly exactIcon = checkmarkCircleOutline;
  protected readonly infoIcon = informationCircleOutline;
  protected readonly errorIcon = alertCircleOutline;

  constructor() {
    // El detalle de un viaje lo busca entre estos (también los de arriba)
    effect(() => {
      const exact = this.exactTrip();
      this.searchState.setResults([
        ...(exact ? [exact] : []),
        ...this.priorityTrips(),
        ...this.trips(),
      ]);
    });
  }

  private async loadResults(search: TripSearch): Promise<FoundTrips> {
    const toResult = (match: TripMatch): TripResult => toTripResult(match, search);
    if (search.relocationRequestId) {
      const options = await this.seatRequests.relocationOptions(search.relocationRequestId);
      const onTime = options.matches.map(toResult);
      const sameDay = options.sameDayMatches.map(toResult);
      // Con uno al 100 %, los que encajan con su horario bajan con los demás
      return options.exactMatch
        ? { exact: toResult(options.exactMatch), priority: [], trips: [...onTime, ...sameDay] }
        : { exact: null, priority: onTime, trips: sameDay };
    }
    const matches = await this.matching.search(toSearchRequest(search));
    return { exact: null, priority: [], trips: matches.map(toResult) };
  }

  ionViewWillEnter(): void {
    this.myRequests.reload();
  }

  handleWidenMargin(): void {
    const search = this.search();
    const margin = this.widerMargin();
    if (search && margin) {
      // Con más margen ya es una búsqueda normal (sin el viaje al 100 %)
      const normalSearch: TripSearch = { ...search, margin };
      delete normalSearch.relocationRequestId;
      this.searchState.set(normalSearch);
    }
  }

  handleRetry(): void {
    this.results.reload();
  }

  isPreferenceMatch(trip: TripResult): boolean {
    return matchesPreferences(this.myPreferences(), driverPreferencesOf(trip));
  }

  handlePreferenceToggle(filter: PreferenceFilter): void {
    this.preferenceFilters.update((current) => {
      const next = new Set(current);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  }

  clearPreferenceFilters(): void {
    this.preferenceFilters.set(new Set());
  }

  handleSortChange(value: string | number | undefined): void {
    if (value === 'arrival' || value === 'detour') {
      this.sortOrder.set(value);
    }
  }
}
