import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonIcon,
  IonInput,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular';
import { carOutline } from 'ionicons/icons';
import { ADMIN_TRIP_STATUSES, AdminTripQuery } from '../../../core/models/admin-trip.model';
import { TripStatus } from '../../../core/models/driver.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminTripsService } from '../../../core/services/admin/admin-trips.service';
import {
  FilterChipOption,
  FilterChips,
  FilterChipTone,
} from '../../../shared/components/ui/filter-chips/filter-chips';
import { ActiveFilter, FiltersCard } from '../../../shared/components/ui/filters-card/filters-card';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  formatDate,
  formatDateTime,
  tripRoute,
  tripStatusLabel,
} from '../users/admin-user-detail-labels';
import { requestsLabel, seatsLabel, tripStatusClass } from './admin-trip-labels';

export const PAGE_SIZE = 20;
const STATUSES = new Set<string>(ADMIN_TRIP_STATUSES);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SKELETON_ROWS = [1, 2, 3, 4, 5];

type TripFilter = 'driver' | 'status' | 'from' | 'to';
// Los que se quitan desde el resumen de «Más filtros»
const CHIP_FILTERS = new Set<string>(['status', 'from', 'to']);
// El punto de cada estado en su chip de filtro, con el color de su etiqueta en
// la lista (tripStatusClass): sin color, gris
const STATUS_FILTER_TONES: Partial<Record<TripStatus, FilterChipTone>> = {
  published: 'info',
  confirmed: 'success',
  in_progress: 'warning',
};

// Un día YYYY-MM-DD de la URL, o nada si no lo es
function dayOf(value: string | undefined): string | undefined {
  return value && DATE_PATTERN.test(value) ? value : undefined;
}

// Viajes del panel, solo lectura, como Usuarios: el buscador por conductor en
// la franja, la tabla con su paginación en la columna de 8 y el estado y los
// días de salida en la de 4 (en el móvil, tras «Más filtros», y cada viaje
// como una tarjeta). Los filtros y la página van en la URL
// (?driver=&status=&from=&to=)
@Component({
  selector: 'app-admin-trips-page',
  imports: [
    FilterChips,
    FiltersCard,
    HeadingContent,
    IonButton,
    IonCard,
    IonIcon,
    IonInput,
    IonSearchbar,
    IonSkeletonText,
    Pagination,
    RouterLink,
  ],
  templateUrl: './admin-trips.page.html',
  styleUrl: './admin-trips.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTripsPage {
  private readonly adminTrips = inject(AdminTripsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Parámetros de la URL (withComponentInputBinding)
  readonly driver = input<string>();
  readonly status = input<string>();
  readonly from = input<string>();
  readonly to = input<string>();
  readonly offset = input<string>();

  readonly query = computed<AdminTripQuery>(() => {
    const status = this.status();
    return {
      driver: this.driver()?.trim() || undefined,
      status: status && STATUSES.has(status) ? (status as TripStatus) : undefined,
      from: dayOf(this.from()),
      to: dayOf(this.to()),
      offset: Math.max(Number(this.offset()) || 0, 0),
      limit: PAGE_SIZE,
    };
  });

  readonly trips = resource({
    params: () => this.query(),
    loader: ({ params }) => this.adminTrips.list(params),
  });

  readonly rows = computed(() =>
    (this.trips.value()?.items ?? []).map((trip) => ({
      id: trip.id,
      departure: formatDateTime(trip.departureAt),
      route: tripRoute(trip),
      driver: trip.driver.name ?? 'Cuenta eliminada',
      seats: seatsLabel(trip),
      requests: requestsLabel(trip),
      status: tripStatusLabel(trip.status),
      statusClass: tripStatusClass(trip.status),
    })),
  );
  readonly total = computed(() => this.trips.value()?.total ?? 0);
  readonly hasFilters = computed(() => {
    const { driver, status, from, to } = this.query();
    return [driver, status, from, to].some(Boolean);
  });
  // Estado y días aplicados, para el resumen del móvil con «Más filtros»
  // cerrado y para su número en el botón
  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const { status, from, to } = this.query();
    const filters: ActiveFilter[] = [];
    if (status) {
      filters.push({ key: 'status', label: tripStatusLabel(status) });
    }
    if (from) {
      filters.push({ key: 'from', label: `Desde el ${formatDate(from)}` });
    }
    if (to) {
      filters.push({ key: 'to', label: `Hasta el ${formatDate(to)}` });
    }
    return filters;
  });
  readonly errorMessage = computed(() => {
    const error = this.trips.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly statusOptions: FilterChipOption[] = ADMIN_TRIP_STATUSES.map((status) => ({
    value: status,
    label: tripStatusLabel(status),
    tone: STATUS_FILTER_TONES[status] ?? 'neutral',
  }));
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly emptyIcon = carOutline;

  // Cambiar un filtro vuelve a la primera página sin tocar los demás (el
  // buscador espera 300 ms antes de avisar)
  async handleFilter(key: TripFilter, value: unknown): Promise<void> {
    await this.navigate({ [key]: typeof value === 'string' && value ? value : null, offset: null });
  }

  async handleRemoveFilter(key: string): Promise<void> {
    if (CHIP_FILTERS.has(key)) {
      await this.handleFilter(key as TripFilter, null);
    }
  }

  async handleOffset(offset: number): Promise<void> {
    await this.navigate({ offset: offset || null });
  }

  async handleClearFilters(): Promise<void> {
    await this.navigate({ driver: null, status: null, from: null, to: null, offset: null });
  }

  handleRetry(): void {
    this.trips.reload();
  }

  private async navigate(queryParams: Record<string, string | number | null>): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
