import { Component, computed, effect, inject, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonModal,
  IonRouterLink,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { alertCircleOutline, close, createOutline, searchOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { TripSearch } from '../../../core/models/trip-search.model';
import { MatchingService } from '../../../core/services/matching/matching.service';
import { formatDateLabel } from '../../../shared/components/ui/datetime-field/datetime-field';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import { CAMPUS_NAME } from '../campus';
import { TripResultCard } from '../trip-result-card/trip-result-card';
import { toSearchRequest, toTripResult } from '../trip-results';
import { MARGINS } from '../trip-search';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { TripSearchStateService } from '../trip-search-state.service';

// «Tu búsqueda»: los viajes que encajan con la búsqueda hecha en Buscar. Arriba,
// fija, el resumen (de dónde a dónde, cuándo y cuántas plazas) con «Editar
// búsqueda», que vuelve al formulario relleno. Mientras busca, los puntos de
// carga y qué se está buscando; después, los resultados, el vacío (con
// «Ampliar margen») o el error (con «Reintentar»)
@Component({
  selector: 'app-search-results',
  imports: [
    RouterLink,
    IonButton,
    IonButtons,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonModal,
    IonRouterLink,
    IonSpinner,
    IonTitle,
    IonToolbar,
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

  // La búsqueda hecha en Buscar, o null si se llega sin buscar
  readonly search = this.searchState.search;

  // Los viajes de la búsqueda; se vuelven a pedir con cada búsqueda nueva
  readonly results = resource({
    params: () => this.search() ?? undefined,
    loader: async ({ params }) =>
      (await this.matching.search(toSearchRequest(params))).map((match) =>
        toTripResult(match, params),
      ),
  });

  readonly trips = computed(() => (this.results.hasValue() ? this.results.value() : []));
  // «Hemos tenido un problema…», con la referencia si es un error del servidor
  readonly errorMessage = computed(() => {
    const error = this.results.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : '';
  });
  // El margen siguiente (para «Ampliar margen»), o null si ya es el mayor
  readonly widerMargin = computed(() => {
    const margin = this.search()?.margin ?? 0;
    return MARGINS.find((value) => value > margin) ?? null;
  });

  // Origen y destino, para la línea de ruta: al ir, la dirección y el
  // parking; al volver, al revés
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
    const seats = search.seats === 1 ? '1 plaza' : `${search.seats} plazas`;
    return `${formatDateLabel(search.date)} · ${time} ${search.time} ± ${search.margin} min · ${seats}`;
  });

  // La ventana con el formulario para editar la búsqueda
  readonly isEditing = signal(false);

  protected readonly editIcon = createOutline;
  protected readonly closeIcon = close;
  protected readonly emptyIcon = searchOutline;
  protected readonly errorIcon = alertCircleOutline;

  constructor() {
    // El detalle de cada viaje sale de los resultados
    effect(() => this.searchState.setResults(this.trips()));
  }

  // «Ampliar margen»: la misma búsqueda con el margen siguiente
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
}
