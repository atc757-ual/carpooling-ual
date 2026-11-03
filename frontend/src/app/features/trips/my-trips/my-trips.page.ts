import {
  Component,
  computed,
  inject,
  linkedSignal,
  resource,
  signal,
  viewChild,
} from '@angular/core';
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
import { LiveTripBanner } from './live-trip-banner/live-trip-banner';
import { MyTripsAside } from './my-trips-aside/my-trips-aside';
import { formatRoute, occupiedSeats, savedCo2Kg, tripsSummary } from './my-trips-summary';
import { driverTripTab, EMPTY_TEXTS, isTripsTab, TRIPS_TABS, TripsTab } from './trip-tabs';

interface LiveBannerData {
  route: string;
  detail: string;
  link: string;
}

// Mis viajes, en tres pestañas: Próximos, Anteriores y Cancelados, con el
// viaje en curso destacado arriba. Como conductor, sus viajes (los próximos,
// con sus solicitudes para aceptarlas o rechazarlas). Como pasajero, sus
// solicitudes, cada una con su viaje (PassengerRequests). En escritorio, a la
// derecha, los atajos, el resumen y las cifras (MyTripsAside)
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
    LiveTripBanner,
    MyTripsAside,
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
  // El viaje que conduce ahora: va destacado arriba y no se repite en Próximos
  private readonly driverLive = computed(
    () => this.allTrips().find(({ status }) => status === 'in_progress') ?? null,
  );
  private readonly driverTrips = computed(() => {
    const live = this.driverLive();
    return this.allTrips().filter((trip) => trip !== live);
  });
  // Los viajes de la pestaña: los próximos, del primero que sale al último;
  // los demás, del más reciente al más antiguo
  readonly tabTrips = computed(() => {
    const trips = this.driverTrips().filter((trip) => driverTripTab(trip) === this.tab());
    return this.tab() === 'upcoming' ? trips : trips.reverse();
  });

  // Las solicitudes del pasajero (con su viaje en curso y sus cifras)
  private readonly passengerRequests = viewChild(PassengerRequests);

  // El viaje en curso del lado que se ve, para destacarlo arriba
  readonly liveBanner = computed<LiveBannerData | null>(() => {
    if (this.isDriver()) {
      const trip = this.driverLive();
      return trip
        ? {
            route: formatRoute(trip),
            detail: `${occupiedSeats(trip)} de ${trip.offeredSeats} plazas ocupadas`,
            link: `/tabs/trips/drive/${trip.id}`,
          }
        : null;
    }
    const item = this.passengerRequests()?.live();
    return item
      ? {
          route: formatRoute(item.trip),
          detail: `Conduce ${item.trip.driver.name}`,
          link: `/tabs/trips/requests/${item.request.id}`,
        }
      : null;
  });

  // La columna derecha en escritorio: resumen y cifras del lado que se ve
  readonly aside = computed(() => {
    const isLive = this.liveBanner() !== null;
    if (this.isDriver()) {
      const trips = this.driverTrips();
      const past = trips.filter((trip) => driverTripTab(trip) === 'past');
      return {
        summary: tripsSummary(
          trips.filter((trip) => driverTripTab(trip) === 'upcoming').length,
          isLive ? 1 : 0,
        ),
        pastCount: past.length,
        co2Kg: savedCo2Kg(past.map((trip) => ({ ...trip, carsAvoided: occupiedSeats(trip) }))),
      };
    }
    const requests = this.passengerRequests();
    const past = requests?.pastTrips() ?? [];
    return {
      summary: tripsSummary(requests?.upcomingCount() ?? 0, isLive ? 1 : 0),
      pastCount: past.length,
      co2Kg: savedCo2Kg(past),
    };
  });
  readonly rating = computed(() => this.auth.currentUser()?.ratings?.[this.view()] ?? null);

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
