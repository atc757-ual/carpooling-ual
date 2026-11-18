import { translate, TranslocoPipe } from '@jsverse/transloco';
import { Component, computed, inject, resource, signal, viewChild } from '@angular/core';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, carOutline } from 'ionicons/icons';
import { TRIP_ENTRIES_PAGE_SIZE, TripEntryResponse } from '../../../core/models/my-trips.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import { ActiveModeService } from '../../../core/services/users/active-mode.service';
import { UsersService } from '../../../core/services/users/users.service';
import { FilterChips } from '../../../shared/components/ui/filter-chips/filter-chips';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { SectionHeading } from '../../tabs/section-heading/section-heading';
import { DriverTripSummary } from '../driver-trip-summary/driver-trip-summary';
import { PassengerTripCard } from '../passenger-trip-card/passenger-trip-card';
import { LiveTripBanner } from './live-trip-banner/live-trip-banner';
import { MyTripsAside } from './my-trips-aside/my-trips-aside';
import { formatRoute, occupiedSeats } from './my-trips-summary';
import {
  driverEntry,
  entryTab,
  groupByDay,
  passengerEntry,
  tabEntries,
  TripEntry,
} from './trip-entries';
import { emptyTextKey, isTripsTab, tripsTabs, TripsTab } from './trip-tabs';
import { LanguageService } from '../../../core/services/ui/language.service';

interface LiveBannerData {
  route: string;
  detail: string;
  link: string;
}

interface LoadedPage {
  entries: TripEntry[];
  total: number;
}

// Tus viajes: una sola lista con los que conduce y en los que va de
// pasajero, cada tarjeta con su papel («Conduces» o «Viajas»), agrupados por
// día y filtrados por estado (Próximos, Anteriores y No realizados). La API
// da cada pestaña ya mezclada y ordenada, de 10 en 10, con el paginador
// debajo. El viaje en curso va destacado arriba. En escritorio, a la
// derecha, los atajos y las cifras (MyTripsAside)
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
    Pagination,
    PassengerTripCard,
    TranslocoPipe,
  ],
  templateUrl: './my-trips.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './my-trips.page.scss'],
})
export class MyTripsPage {
  private readonly driver = inject(DriverService);
  private readonly tripsService = inject(TripsService);
  private readonly users = inject(UsersService);
  private readonly activeMode = inject(ActiveModeService);
  private readonly auth = inject(AuthService);
  private readonly content = viewChild(IonContent);

  readonly canDrive = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('driver');
  });
  readonly canRide = computed(() => {
    this.auth.currentUser();
    return this.auth.hasProfile('passenger');
  });

  // El filtro de estado (Próximos al entrar) y la página de cada pestaña
  readonly tab = signal<TripsTab>('upcoming');
  private readonly offsets = signal<Record<TripsTab, number>>({
    upcoming: 0,
    past: 0,
    cancelled: 0,
  });
  readonly offset = computed(() => this.offsets()[this.tab()]);
  readonly emptyText = computed(() => emptyTextKey(this.tab()));
  // Sin viajes por venir: invita a buscar o publicar
  readonly isUpcomingView = computed(() => this.tab() === 'upcoming');
  protected readonly pageSize = TRIP_ENTRIES_PAGE_SIZE;

  // La página abierta, con el viaje de cada solicitud
  readonly page = resource({
    params: () => ({ tab: this.tab(), offset: this.offset() }),
    loader: ({ params }) => this.loadPage(params.tab, params.offset),
  });
  // La primera de Próximos, por el viaje en curso, cuando la abierta es otra
  private readonly isUpcomingStart = computed(
    () => this.tab() === 'upcoming' && this.offset() === 0,
  );
  private readonly upcomingStart = resource({
    params: () => (this.isUpcomingStart() ? undefined : true),
    loader: () => this.loadPage('upcoming', 0),
  });

  readonly isLoading = computed(() => this.page.isLoading());
  readonly hasError = computed(() => !!this.page.error());
  readonly total = computed(() => (this.page.hasValue() ? this.page.value().total : 0));
  private readonly pageEntries = computed(() =>
    this.page.hasValue() ? this.page.value().entries : [],
  );
  private readonly upcomingEntries = computed(() => {
    if (this.isUpcomingStart()) {
      return this.pageEntries();
    }
    return this.upcomingStart.hasValue() ? this.upcomingStart.value().entries : [];
  });

  // El viaje en curso de cada papel: va destacado arriba y no se repite en la lista
  private readonly driverLive = computed(() => {
    for (const entry of this.upcomingEntries()) {
      if (entry.role === 'driver' && entry.trip.status === 'in_progress') {
        return entry;
      }
    }
    return null;
  });
  private readonly passengerLive = computed(() => {
    for (const entry of this.upcomingEntries()) {
      if (
        entry.role === 'passenger' &&
        entry.item.request.status === 'accepted' &&
        entry.item.trip.status === 'in_progress'
      ) {
        return entry;
      }
    }
    return null;
  });

  // Cuántas solicitudes faltan por responder en cada viaje abierto de la
  // página. Si no se pueden cargar, la lista se ve igual, sin el recuento
  private readonly pendingRequests = resource({
    params: () => {
      const ids = this.pageEntries()
        .flatMap((entry) => (entry.role === 'driver' ? [entry.trip] : []))
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

  // La página, sin el viaje en curso (va arriba), con el recuento de cada viaje
  readonly tabEntries = computed(() => {
    const live = new Set([this.driverLive()?.id, this.passengerLive()?.id]);
    const entries = this.pageEntries()
      .filter(({ id }) => !live.has(id))
      .map((entry) =>
        entry.role === 'driver'
          ? driverEntry(entry.trip, this.pendingCounts().get(entry.trip.id))
          : entry,
      );
    return tabEntries(entries, this.tab());
  });
  readonly dayGroups = computed(() => groupByDay(this.tabEntries()));

  // El viaje en curso, para destacarlo arriba (el que conduce, si los hubiera de los dos)
  readonly liveBanner = computed<LiveBannerData | null>(() => {
    const driverLive = this.driverLive();
    if (driverLive) {
      const { trip } = driverLive;
      return {
        route: formatRoute(trip),
        detail: translate('screens.myTrips.plazasOcupadas', {
          value1: occupiedSeats(trip),
          offeredSeats: trip.offeredSeats,
        }),
        link: `/tabs/trips/drive/${trip.id}`,
      };
    }
    const passengerLive = this.passengerLive();
    if (!passengerLive) {
      return null;
    }
    const { trip, request } = passengerLive.item;
    return {
      route: formatRoute(trip),
      detail: `Conduce ${trip.driver.name}`,
      link: `/tabs/trips/ride/${request.id}`,
    };
  });

  // La columna de 4: el CO₂ ahorrado con los dos papeles, de la API (la lista
  // solo tiene una página). Sin él, 0
  private readonly impact = resource({
    params: () => (this.canDrive() || this.canRide() ? true : undefined),
    loader: () => this.users.getImpact(),
  });
  readonly co2Kg = computed(() => (this.impact.hasValue() ? this.impact.value().co2Kg : 0));
  // La valoración del papel con el que usa la app ahora
  readonly rating = computed(() => {
    const role = this.activeMode.mode() === 'driver' && this.canDrive() ? 'driver' : 'passenger';
    return this.auth.currentUser()?.ratings?.[role] ?? null;
  });

  // Qué hacer cuando no hay próximos, según los papeles que tiene
  readonly emptyHint = computed(() => {
    if (this.canRide() && this.canDrive()) {
      return translate('screens.myTrips.buscaViajeEncajeRuta');
    }
    return this.canDrive()
      ? translate('screens.myTrips.publicaRecorridoAquiVeras')
      : translate('screens.myTrips.buscaViajeEncajeRuta2');
  });

  private readonly language = inject(LanguageService);
  protected readonly tabs = computed(() => {
    this.language.currentLanguage();
    return tripsTabs();
  });
  protected readonly entryTab = entryTab;
  protected readonly emptyIcon = carOutline;
  protected readonly errorIcon = alertCircleOutline;

  handleTabChange(value: string | null): void {
    if (isTripsTab(value)) {
      this.tab.set(value);
    }
  }

  // Otra página: arriba de la lista para leerla desde el principio
  handlePageChange(offset: number): void {
    this.offsets.update((offsets) => ({ ...offsets, [this.tab()]: offset }));
    void this.content()?.scrollToTop(300);
  }

  handleRetry(): void {
    this.page.reload();
  }

  // Al volver a la pestaña (p. ej. tras terminar un viaje en su pantalla), la
  // página al día; la primera vez ya se está cargando
  ionViewWillEnter(): void {
    for (const loaded of [this.page, this.upcomingStart, this.impact]) {
      if (loaded.status() !== 'loading' && loaded.status() !== 'idle') {
        loaded.reload();
      }
    }
  }

  // Cada fila con su tarjeta: el viaje que conduce, o la solicitud con su
  // viaje (uno por solicitud: como mucho 10)
  private async loadPage(tab: TripsTab, offset: number): Promise<LoadedPage> {
    const page = await this.tripsService.listMyTripEntries(tab, offset);
    const entries = await Promise.all(page.items.map((item) => this.toEntry(item)));
    return { entries, total: page.total };
  }

  private async toEntry(item: TripEntryResponse): Promise<TripEntry> {
    if (item.role === 'driver') {
      return driverEntry(item.trip);
    }
    const trip = await this.tripsService.getTrip(item.request.trip.id);
    return passengerEntry({ request: item.request, trip });
  }
}
