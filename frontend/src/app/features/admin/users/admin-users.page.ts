import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonCard, IonIcon, IonSearchbar, IonSkeletonText } from '@ionic/angular';
import { chevronForwardOutline, peopleOutline } from 'ionicons/icons';
import {
  ADMIN_USER_STATUSES,
  AdminUserQuery,
  AdminUserStatus,
} from '../../../core/models/admin-user.model';
import { ApiError } from '../../../core/models/api-error.model';
import { Profile } from '../../../core/models/user.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
import {
  FilterChipOption,
  FilterChips,
} from '../../../shared/components/ui/filter-chips/filter-chips';
import { ActiveFilter, FiltersCard } from '../../../shared/components/ui/filters-card/filters-card';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { initialsOf } from './admin-user-detail-labels';
import {
  PROFILE_LABELS,
  rolesLabel,
  STATUS_LABELS,
  STATUS_TONES,
  statusChips,
} from './admin-user-labels';

export const PAGE_SIZE = 20;
const PROFILES = new Set<string>(['driver', 'passenger', 'admin']);
const STATUSES = new Set<string>(ADMIN_USER_STATUSES);
// Filas del esqueleto mientras carga la primera página
const SKELETON_ROWS = [1, 2, 3, 4, 5];

type FilterKey = 'search' | 'profile' | 'status';
// Los que se quitan desde el resumen de «Más filtros»
const CHIP_FILTERS = new Set<string>(['profile', 'status']);

// Usuarios del panel (RF-25, CU-13): la tabla con su estado y paginación en
// la columna de 8 y el buscador y los filtros en la de 4. En el móvil, el
// buscador arriba y el resto de filtros tras «Más filtros», y cada fila como
// una tarjeta. Los filtros y la página van en la URL (?search=&profile=…),
// así se conservan al volver del detalle
@Component({
  selector: 'app-admin-users-page',
  imports: [
    FilterChips,
    FiltersCard,
    HeadingContent,
    IonButton,
    IonCard,
    IonIcon,
    IonSearchbar,
    IonSkeletonText,
    Pagination,
    RouterLink,
  ],
  templateUrl: './admin-users.page.html',
  styleUrl: './admin-users.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersPage {
  private readonly adminUsers = inject(AdminUsersService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Parámetros de la URL (withComponentInputBinding)
  readonly search = input<string>();
  readonly profile = input<string>();
  readonly status = input<string>();
  readonly offset = input<string>();

  readonly query = computed<AdminUserQuery>(() => {
    const profile = this.profile();
    const status = this.status();
    return {
      search: this.search()?.trim() || undefined,
      profile: profile && PROFILES.has(profile) ? (profile as Profile) : undefined,
      status: status && STATUSES.has(status) ? (status as AdminUserStatus) : undefined,
      offset: Math.max(Number(this.offset()) || 0, 0),
      limit: PAGE_SIZE,
    };
  });

  readonly users = resource({
    params: () => this.query(),
    loader: ({ params }) => this.adminUsers.list(params),
  });

  readonly rows = computed(() =>
    (this.users.value()?.items ?? []).map((row) => ({
      row,
      roles: rolesLabel(row),
      chips: statusChips(row),
      initials: initialsOf(row.name),
    })),
  );
  readonly total = computed(() => this.users.value()?.total ?? 0);
  readonly hasFilters = computed(() => {
    const { search, profile, status } = this.query();
    return Boolean(search || profile || status);
  });
  // Perfil y estado aplicados, para el resumen del móvil con «Más filtros»
  // cerrado y para su número en el botón
  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const { profile, status } = this.query();
    const filters: ActiveFilter[] = [];
    if (profile) {
      filters.push({ key: 'profile', label: PROFILE_LABELS[profile] });
    }
    if (status) {
      filters.push({ key: 'status', label: STATUS_LABELS[status] });
    }
    return filters;
  });
  readonly errorMessage = computed(() => {
    const error = this.users.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly profileOptions: FilterChipOption[] = Object.entries(PROFILE_LABELS).map(
    ([value, label]) => ({ value, label }),
  );
  protected readonly statusOptions: FilterChipOption[] = Object.entries(STATUS_LABELS).map(
    ([value, label]) => ({ value, label, tone: STATUS_TONES[value as AdminUserStatus] }),
  );
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly emptyIcon = peopleOutline;
  protected readonly rowLinkIcon = chevronForwardOutline;

  // El buscador espera 300 ms (debounce) antes de avisar
  async handleSearch(event: CustomEvent<{ value?: string | null }>): Promise<void> {
    await this.handleFilter('search', event.detail.value);
  }

  // Cambiar un filtro vuelve a la primera página sin tocar los demás
  async handleFilter(key: FilterKey, value: string | null | undefined): Promise<void> {
    await this.navigate({ [key]: value || null, offset: null });
  }

  async handleRemoveFilter(key: string): Promise<void> {
    if (CHIP_FILTERS.has(key)) {
      await this.handleFilter(key as FilterKey, null);
    }
  }

  async handleOffset(offset: number): Promise<void> {
    await this.navigate({ offset: offset || null });
  }

  async handleClearFilters(): Promise<void> {
    await this.navigate({ search: null, profile: null, status: null, offset: null });
  }

  handleRetry(): void {
    this.users.reload();
  }

  private async navigate(queryParams: Record<string, string | number | null>): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
