import { Component, computed, inject, linkedSignal, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonRouterLink,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, carOutline } from 'ionicons/icons';
import { DriverTrip } from '../../../core/models/driver.model';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ActiveModeService, TravelMode } from '../../../core/services/users/active-mode.service';
import { DriverTripCard } from '../driver-trip-card/driver-trip-card';
import { PassengerRequests } from '../passenger-requests/passenger-requests';
import { driverTripTab, EMPTY_TEXTS, isTripsTab, TRIPS_TABS, TripsTab } from './trip-tabs';

// Mis viajes, en tres pestañas: Próximos, Anteriores y Cancelados. Como
// conductor, sus viajes (los próximos, con sus solicitudes para aceptarlas o
// rechazarlas). Como pasajero, sus solicitudes, cada una con su viaje
// (PassengerRequests)
@Component({
  selector: 'app-my-trips',
  imports: [
    RouterLink,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonRouterLink,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonSpinner,
    DriverTripCard,
    PassengerRequests,
  ],
  templateUrl: './my-trips.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './my-trips.page.scss'],
})
export class MyTripsPage {
  private readonly driver = inject(DriverService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly auth = inject(AuthService);

  // Con perfil de conductor, un segmento elige qué se ve; empieza por el
  // último lado usado (activeMode). Sin él, sus solicitudes
  readonly canDrive = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('driver');
  });
  readonly view = linkedSignal<TravelMode>(() =>
    this.activeMode.mode() === 'driver' && this.canDrive() ? 'driver' : 'passenger',
  );
  readonly isDriver = computed(() => this.view() === 'driver');

  readonly trips = resource({
    params: () => (this.isDriver() ? true : undefined),
    loader: () => this.driver.listMyTrips(),
  });
  private readonly allTrips = computed<readonly DriverTrip[]>(() =>
    this.trips.hasValue() ? this.trips.value() : [],
  );
  readonly tab = signal<TripsTab>('upcoming');
  // Los viajes de la pestaña: los próximos, del primero que sale al último;
  // los demás, del más reciente al más antiguo
  readonly tabTrips = computed(() => {
    const trips = this.allTrips().filter((trip) => driverTripTab(trip) === this.tab());
    return this.tab() === 'upcoming' ? trips : trips.reverse();
  });

  protected readonly tabs = TRIPS_TABS;
  protected readonly emptyTexts = EMPTY_TEXTS;
  protected readonly emptyIcon = carOutline;
  protected readonly errorIcon = alertCircleOutline;

  // Los segmentos dan su valor sin tipo
  handleViewChange(value: string | number | undefined): void {
    if (value === 'passenger' || value === 'driver') {
      this.view.set(value);
    }
  }

  handleTabChange(value: string | number | undefined): void {
    if (isTripsTab(value)) {
      this.tab.set(value);
    }
  }

  handleChanged(): void {
    this.trips.reload();
  }

  // Al volver a la pestaña (p. ej. tras terminar un viaje en su pantalla), la
  // lista al día; la primera vez ya se está cargando
  ionViewWillEnter(): void {
    if (this.isDriver() && !this.trips.isLoading()) {
      this.trips.reload();
    }
  }
}
