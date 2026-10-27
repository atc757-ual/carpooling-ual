import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonRouterLink,
} from '@ionic/angular';
import { carOutline, mapOutline } from 'ionicons/icons';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import { getExampleTripDetail } from '../example-trips';
import { getFirstName, TripDriver } from '../trip-driver/trip-driver';
import { formatShortDate } from '../trip-search-summary/trip-search-summary';
import { TripSearchStateService } from '../trip-search-state.service';

// Detalle de un viaje de los resultados de Buscar: el recorrido con sus horas,
// quien conduce y su coche, y cómo funciona la solicitud. De momento es el
// viaje de ejemplo, con los datos de la búsqueda; sin búsqueda (o con otro
// id), «No encontramos este viaje». Pedir plaza llega en el PR de solicitudes
@Component({
  selector: 'app-trip-detail',
  imports: [
    RouterLink,
    IonBadge,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonRouterLink,
    RouteTimeline,
    TripDriver,
  ],
  templateUrl: './trip-detail.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './trip-detail.page.scss'],
})
export class TripDetailPage {
  private readonly searchState = inject(TripSearchStateService);

  // :id de la ruta (withComponentInputBinding)
  readonly id = input.required<string>();

  readonly trip = computed(() => getExampleTripDetail(this.id(), this.searchState.search()));

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
  readonly requestedSeats = computed(() => {
    const seats = this.searchState.search()?.seats ?? 1;
    return seats === 1 ? '1 plaza' : `${seats} plazas`;
  });

  protected readonly carIcon = carOutline;
  protected readonly notFoundIcon = mapOutline;
}
