import { Component, computed, inject, linkedSignal } from '@angular/core';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
} from '@ionic/angular';
import { searchOutline } from 'ionicons/icons';
import { getExampleTrip } from '../example-trips';
import { TripResultCard } from '../trip-result-card/trip-result-card';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { TripSearchStateService } from '../trip-search-state.service';
import { TripSearchSummary } from '../trip-search-summary/trip-search-summary';

// Buscar (pasajero). La búsqueda es la última hecha, en Inicio o aquí
// (TripSearchStateService, no va en la URL). Arriba en el móvil y en la columna de 4 en escritorio, «Tu
// búsqueda»: su resumen con «Editar» o, si aún no se ha buscado (o se está
// editando), el formulario. Al lado, los resultados (por ahora, un viaje de
// ejemplo marcado como tal, hasta que haya matching) o, sin búsqueda, qué se
// verá ahí. La cabecera («Buscar viaje», con la flecha de volver en el móvil)
// la pone la pestaña con el data de la ruta
@Component({
  selector: 'app-trip-search',
  imports: [
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonIcon,
    TripResultCard,
    TripSearchForm,
    TripSearchSummary,
  ],
  templateUrl: './trip-search.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-search.page.scss'],
})
export class TripSearchPage {
  private readonly searchState = inject(TripSearchStateService);

  // La última búsqueda, o null si aún no se ha buscado
  readonly search = this.searchState.search;

  // Editando la búsqueda: se cierra al buscar y con cada búsqueda nueva (la
  // pestaña se conserva al buscar desde Inicio)
  readonly isEditing = linkedSignal({ source: this.search, computation: () => false });

  // Viaje de ejemplo adaptado a la búsqueda, mientras no hay matching
  readonly exampleTrip = computed(() => {
    const search = this.search();
    return search ? getExampleTrip(search) : null;
  });

  protected readonly emptyIcon = searchOutline;

  // Empezar de cero: sin búsqueda, el formulario vacío (también el de Inicio)
  handleNewSearch(): void {
    this.searchState.clear();
  }
}
