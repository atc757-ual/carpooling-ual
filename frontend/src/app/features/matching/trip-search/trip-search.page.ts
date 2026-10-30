import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonRouterLink,
} from '@ionic/angular';
import { carOutline, timeOutline } from 'ionicons/icons';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { TripSearchStateService } from '../trip-search-state.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { FaqCard } from '../../../shared/components/ui/faq-card/faq-card';
import { SEARCH_FAQS } from '../search-faqs';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';

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
    RouterLink,
    IonRouterLink,
    IonItem,
    IonLabel,
    FaqCard,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    TripSearchForm,
  ],
  templateUrl: './trip-search.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-search.page.scss'],
})
export class TripSearchPage {
  private readonly auth = inject(AuthService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly searchState = inject(TripSearchStateService);

  // Sin coche registrado aún: se le invita a publicar
  readonly isDriver = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('driver');
  });

  // Cuántas de sus solicitudes esperan respuesta (0: sin aviso). Si no se
  // pueden cargar, no se avisa: no es motivo para un error
  private readonly myRequests = resource({
    loader: () => this.seatRequests.listMine().catch(() => []),
  });
  readonly pendingRequests = computed(() =>
    this.myRequests.hasValue()
      ? this.myRequests.value().filter(({ status }) => status === 'pending').length
      : 0,
  );

  // La última búsqueda, o null si aún no se ha buscado
  readonly search = this.searchState.search;

  protected readonly pendingIcon = timeOutline;
  protected readonly carIcon = carOutline;
  protected readonly faqs = SEARCH_FAQS;

  // Empezar de cero: sin búsqueda, el formulario vacío
  handleNewSearch(): void {
    this.searchState.clear();
  }
}
