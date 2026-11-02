import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonInput,
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
} from '@ionic/angular';
import { ADMIN_TRIP_STATUSES, AdminTripQuery } from '../../../core/models/admin-trip.model';
import { TripStatus } from '../../../core/models/driver.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminTripsService } from '../../../core/services/admin/admin-trips.service';
import { formatCount, Pagination } from '../../../shared/components/ui/pagination/pagination';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatDateTime, tripRoute, tripStatusLabel } from '../users/admin-user-detail-labels';
import { requestsLabel, seatsLabel, tripStatusClass } from './admin-trip-labels';

export const PAGE_SIZE = 20;
const STATUSES = new Set<string>(ADMIN_TRIP_STATUSES);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SKELETON_ROWS = [1, 2, 3, 4, 5];

type TripFilter = 'driver' | 'status' | 'from' | 'to';

// Un día YYYY-MM-DD de la URL, o nada si no lo es
function dayOf(value: string | undefined): string | undefined {
  return value && DATE_PATTERN.test(value) ? value : undefined;
}

// Viajes del panel, solo lectura: buscador por conductor, estado y días de
// salida, tabla y paginación. Los filtros y la página van en la URL
// (?driver=&status=&from=&to=), como en Usuarios
@Component({
  selector: 'app-admin-trips-page',
  imports: [
    IonButton,
    IonInput,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
    IonSkeletonText,
    Pagination,
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
  readonly totalLabel = computed(() => formatCount(this.total()));
  readonly hasFilters = computed(() => {
    const { driver, status, from, to } = this.query();
    return [driver, status, from, to].some(Boolean);
  });
  readonly errorMessage = computed(() => {
    const error = this.trips.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly statusOptions = ADMIN_TRIP_STATUSES.map((status) => ({
    value: status,
    label: tripStatusLabel(status),
  }));
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = PAGE_SIZE;

  // Cambiar un filtro vuelve a la primera página sin tocar los demás (el
  // buscador espera 300 ms antes de avisar)
  async handleFilter(key: TripFilter, value: unknown): Promise<void> {
    await this.navigate({ [key]: typeof value === 'string' && value ? value : null, offset: null });
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
