import { Component, computed, effect, inject, linkedSignal, resource } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, searchOutline } from 'ionicons/icons';
import { ApiError } from '../../../core/models/api-error.model';
import { TripSearch } from '../../../core/models/trip-search.model';
import { MatchingService } from '../../../core/services/matching/matching.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { TripResultCard } from '../trip-result-card/trip-result-card';
import { toSearchRequest, toTripResult } from '../trip-results';
import { MARGINS } from '../trip-search';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { TripSearchStateService } from '../trip-search-state.service';
import { TripSearchSummary } from '../trip-search-summary/trip-search-summary';

// Buscar (pasajero). La búsqueda es la última hecha, en Inicio o aquí
// (TripSearchStateService, no va en la URL). Arriba en el móvil y en la
// columna de 4 en escritorio, «Tu búsqueda»: su resumen con «Editar» o, si aún
// no se ha buscado (o se está editando), el formulario. Al lado, los viajes
// que encajan (matching, POST /api/trips/search), del más compatible al menos,
// con sus estados: cargando, ninguno (con «Modificar hora» y «Ampliar
// margen»), error (con «Reintentar») o, sin búsqueda, qué se verá ahí. La
// cabecera la pone la pestaña con el data de la ruta
@Component({
  selector: 'app-trip-search',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    IonSpinner,
    TripResultCard,
    TripSearchForm,
    TripSearchSummary,
  ],
  templateUrl: './trip-search.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-search.page.scss'],
})
export class TripSearchPage {
  private readonly searchState = inject(TripSearchStateService);
  private readonly matching = inject(MatchingService);

  // La última búsqueda, o null si aún no se ha buscado
  readonly search = this.searchState.search;

  // Editando la búsqueda: se cierra al buscar y con cada búsqueda nueva (la
  // pestaña se conserva al buscar desde Inicio)
  readonly isEditing = linkedSignal({ source: this.search, computation: () => false });

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

  protected readonly emptyIcon = searchOutline;
  protected readonly errorIcon = alertCircleOutline;

  constructor() {
    // El detalle de cada viaje sale de los resultados
    effect(() => this.searchState.setResults(this.trips()));
  }

  // Empezar de cero: sin búsqueda, el formulario vacío (también el de Inicio)
  handleNewSearch(): void {
    this.searchState.clear();
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
