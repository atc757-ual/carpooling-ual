import { Component, computed, inject, resource, signal } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, carOutline } from 'ionicons/icons';
import { DriverTrip } from '../../../core/models/driver.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { SeatRequestsService } from '../../../core/services/requests/seat-requests.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { FilterChips } from '../../../shared/components/ui/filter-chips/filter-chips';
import { SectionHeading } from '../../tabs/section-heading/section-heading';
import { DriverTripSummary } from '../driver-trip-summary/driver-trip-summary';
import { PassengerTripCard } from '../passenger-trip-card/passenger-trip-card';
import { LiveTripBanner } from './live-trip-banner/live-trip-banner';
import { MyTripsAside } from './my-trips-aside/my-trips-aside';
import { formatRoute, occupiedSeats, savedCo2Kg } from './my-trips-summary';
import {
  driverEntry,
  entryTab,
  groupByDay,
  PassengerTrip,
  passengerEntry,
  tabEntries,
} from './trip-entries';
import { EMPTY_TEXTS, isTripsTab, TRIPS_TABS, TripsTab } from './trip-tabs';

interface LiveBannerData {
  route: string;
  detail: string;
  link: string;
}

// Tus viajes: una sola lista con los que conduce y en los que va de
// pasajero, cada tarjeta con su papel («Conduces» o «Viajas»), agrupados por
// día y filtrados por estado (Próximos, Anteriores y No realizados). El viaje
// en curso va destacado arriba. En escritorio, a la derecha, los atajos, el
// resumen y las cifras (MyTripsAside)
@Component({
  selector: 'app-my-trips',
  imports: [
    SectionHeading,
    IonButton,
    IonCard,
    IonCardContent,
    IonContent,
    IonIcon,
    IonSpinner,
    DriverTripSummary,
    FilterChips,
    LiveTripBanner,
    MyTripsAside,
    PassengerTripCard,
  ],
  templateUrl: './my-trips.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './my-trips.page.scss'],
})
export class MyTripsPage {
  private readonly driver = inject(DriverService);
  private readonly seatRequests = inject(SeatRequestsService);
  private readonly tripsService = inject(TripsService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly auth = inject(AuthService);

  // Cada papel carga lo suyo solo si el usuario lo tiene
  readonly canDrive = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('driver');
  });
  readonly canRide = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('passenger');
  });

  readonly trips = resource({
    params: () => (this.canDrive() ? true : undefined),
    loader: () => this.driver.listMyTrips(),
  });
  // Cada solicitud del pasajero con su viaje (uno por solicitud: tiene pocas)
  readonly requests = resource({
    params: () => (this.canRide() ? true : undefined),
    loader: async (): Promise<PassengerTrip[]> => {
      const requests = await this.seatRequests.listMine();
      return Promise.all(
        requests.map(async (request) => ({
          request,
          trip: await this.tripsService.getTrip(request.trip.id),
        })),
      );
    },
  });

  // El filtro de estado: Próximos al entrar
  readonly tab = signal<TripsTab>('upcoming');
  readonly emptyText = computed(() => EMPTY_TEXTS[this.tab()]);
  // Sin viajes por venir: invita a buscar o publicar
  readonly isUpcomingView = computed(() => this.tab() === 'upcoming');
  readonly isLoading = computed(
    () =>
      (this.trips.isLoading() && !this.trips.hasValue()) ||
      (this.requests.isLoading() && !this.requests.hasValue()),
  );
  readonly hasError = computed(() => !!this.trips.error() || !!this.requests.error());

  private readonly allTrips = computed<readonly DriverTrip[]>(() =>
    this.trips.hasValue() ? this.trips.value() : [],
  );
  private readonly allRequests = computed<readonly PassengerTrip[]>(() =>
    this.requests.hasValue() ? this.requests.value() : [],
  );
  // El viaje en curso de cada papel: va destacado arriba y no se repite en Próximos
  private readonly driverLive = computed(
    () => this.allTrips().find(({ status }) => status === 'in_progress') ?? null,
  );
  private readonly passengerLive = computed(
    () =>
      this.allRequests().find(
        ({ request, trip }) => request.status === 'accepted' && trip.status === 'in_progress',
      ) ?? null,
  );
  private readonly driverTrips = computed(() =>
    this.allTrips().filter((trip) => trip !== this.driverLive()),
  );

  // Cuántas solicitudes faltan por responder en cada viaje abierto. Si no se
  // pueden cargar, la lista se ve igual, sin el recuento
  private readonly pendingRequests = resource({
    params: () => {
      const ids = this.driverTrips()
        .filter(({ status }) => status === 'published' || status === 'confirmed')
        .map(({ id }) => id);
      return ids.length > 0 ? ids : undefined;
    },
    loader: async ({ params: ids }) =>
      new Map(
        await Promise.all(
          ids.map(async (id): Promise<[string, number]> => {
            const requests = await this.driver.listTripRequests(id);
            return [id, requests.filter(({ status }) => status === 'pending').length];
          }),
        ),
      ),
  });
  readonly pendingCounts = computed(() =>
    this.pendingRequests.hasValue() ? this.pendingRequests.value() : new Map<string, number>(),
  );

  // Los dos papeles juntos (sin los viajes en curso)
  readonly entries = computed(() => [
    ...this.driverTrips().map((trip) => driverEntry(trip, this.pendingCounts().get(trip.id))),
    ...this.allRequests()
      .filter((item) => item !== this.passengerLive())
      .map((item) => passengerEntry(item)),
  ]);
  readonly tabEntries = computed(() => tabEntries(this.entries(), this.tab()));
  readonly dayGroups = computed(() => groupByDay(this.tabEntries()));

  // El viaje en curso, para destacarlo arriba (el que conduce, si los hubiera de los dos)
  readonly liveBanner = computed<LiveBannerData | null>(() => {
    const trip = this.driverLive();
    if (trip) {
      return {
        route: formatRoute(trip),
        detail: `${occupiedSeats(trip)} de ${trip.offeredSeats} plazas ocupadas`,
        link: `/tabs/trips/drive/${trip.id}`,
      };
    }
    const item = this.passengerLive();
    return item
      ? {
          route: formatRoute(item.trip),
          detail: `Conduce ${item.trip.driver.name}`,
          link: `/tabs/trips/requests/${item.request.id}`,
        }
      : null;
  });

  // La columna de 4: las cifras de los dos papeles. Como conductor evita un
  // coche por pasajero; como pasajero, el suyo
  readonly aside = computed(() => {
    const past = this.entries().filter((entry) => entryTab(entry) === 'past');
    const avoided = past.map((entry) =>
      entry.role === 'driver'
        ? { ...entry.trip, carsAvoided: occupiedSeats(entry.trip) }
        : { ...entry.item.trip, carsAvoided: 1 },
    );
    return { co2Kg: savedCo2Kg(avoided) };
  });
  // La valoración del papel con el que usa la app ahora
  readonly rating = computed(() => {
    const role = this.activeMode.mode() === 'driver' && this.canDrive() ? 'driver' : 'passenger';
    return this.auth.currentUser()?.ratings?.[role] ?? null;
  });

  // Qué hacer cuando no hay próximos, según los papeles que tiene
  readonly emptyHint = computed(() => {
    if (this.canRide() && this.canDrive()) {
      return 'Busca un viaje que encaje con tu ruta o publica tu recorrido.';
    }
    return this.canDrive()
      ? 'Publica tu recorrido y aquí verás quién te pide plaza.'
      : 'Busca un viaje que encaje con tu ruta y pide plaza desde su detalle.';
  });

  protected readonly tabs = TRIPS_TABS;
  protected readonly entryTab = entryTab;
  protected readonly emptyIcon = carOutline;
  protected readonly errorIcon = alertCircleOutline;

  handleTabChange(value: string | null): void {
    if (isTripsTab(value)) {
      this.tab.set(value);
    }
  }

  handleRetry(): void {
    this.reload();
  }

  // Al volver a la pestaña (p. ej. tras terminar un viaje en su pantalla), la
  // lista al día; la primera vez ya se está cargando
  ionViewWillEnter(): void {
    if (!this.trips.isLoading() && !this.requests.isLoading()) {
      this.reload();
    }
  }

  private reload(): void {
    if (this.canDrive()) {
      this.trips.reload();
    }
    if (this.canRide()) {
      this.requests.reload();
    }
  }
}
