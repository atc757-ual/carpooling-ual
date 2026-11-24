import { TranslocoPipe } from '@jsverse/transloco';
import { NextTripCard } from '../../trips/next-trip-card/next-trip-card';
import { Component, computed, inject, resource, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonRouterLink,
} from '@ionic/angular';
import { carOutline, chevronForward, timeOutline } from 'ionicons/icons';
import { UsualTripCard } from '../usual-trip/usual-trip-card/usual-trip-card';
import { TripSearchForm } from '../trip-search-form/trip-search-form';
import { AuthService } from '../../../core/services/auth/auth.service';
import { QuickFaqs } from '../../../shared/components/ui/quick-faqs/quick-faqs';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { SectionHeading } from '../../../shared/components/layout/section-heading/section-heading';
import { fallbackOnApiError } from '../../../core/models/api-error.model';

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
    SectionHeading,
    RouterLink,
    IonRouterLink,
    IonItem,
    IonLabel,
    QuickFaqs,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    TripSearchForm,
    UsualTripCard,
    NextTripCard,
    TranslocoPipe,
  ],
  templateUrl: './trip-search.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-search.page.scss'],
})
export class TripSearchPage {
  private readonly auth = inject(AuthService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly nextTrip = viewChild(NextTripCard);

  // Sin coche registrado aún: se le invita a publicar
  readonly isDriver = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('driver');
  });

  // Cuántas de sus solicitudes esperan respuesta (0: sin aviso). Si no se
  // pueden cargar, no se avisa: no es motivo para un error
  private readonly myRequests = resource({
    loader: () => this.seatRequests.listMine().catch(fallbackOnApiError([])),
  });
  private readonly pendingList = computed(() =>
    this.myRequests.hasValue()
      ? this.myRequests.value().filter(({ status }) => status === 'pending')
      : [],
  );
  readonly pendingRequests = computed(() => this.pendingList().length);
  // Con una sola, el aviso lleva a ella; con varias, a Tus viajes
  readonly pendingLink = computed(() => {
    const pending = this.pendingList();
    return pending.length === 1 ? ['/tabs/trips/requests', pending[0].id] : ['/tabs/trips'];
  });

  protected readonly pendingIcon = timeOutline;
  protected readonly chevronIcon = chevronForward;
  protected readonly carIcon = carOutline;

  // Ionic guarda la pantalla: al volver a la pestaña, el próximo viaje y el
  // aviso de solicitudes se piden de nuevo
  ionViewWillEnter(): void {
    this.nextTrip()?.reload();
    this.myRequests.reload();
  }
}
