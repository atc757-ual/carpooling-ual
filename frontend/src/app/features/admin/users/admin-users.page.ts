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
  IonSearchbar,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
} from '@ionic/angular';
import {
  ADMIN_USER_STATUSES,
  AdminUserQuery,
  AdminUserStatus,
} from '../../../core/models/admin-user.model';
import { ApiError } from '../../../core/models/api-error.model';
import { Profile } from '../../../core/models/user.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
import { formatCount, Pagination } from '../../../shared/components/ui/pagination/pagination';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { PROFILE_LABELS, rolesLabel, STATUS_LABELS, statusChips } from './admin-user-labels';

export const PAGE_SIZE = 20;
const PROFILES = new Set<string>(['driver', 'passenger', 'admin']);
const STATUSES = new Set<string>(ADMIN_USER_STATUSES);
// Filas del esqueleto mientras carga la primera página
const SKELETON_ROWS = [1, 2, 3, 4, 5];

type FilterKey = 'search' | 'profile' | 'status';

// Usuarios del panel (RF-25, CU-13): buscador, filtros, tabla con su estado
// y paginación. Los filtros y la página van en la URL (?search=&profile=…),
// así se conservan al volver del detalle
@Component({
  selector: 'app-admin-users-page',
  imports: [
    IonButton,
    IonSearchbar,
    IonSelect,
    IonSelectOption,
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
    })),
  );
  readonly total = computed(() => this.users.value()?.total ?? 0);
  readonly totalLabel = computed(() => formatCount(this.total()));
  readonly hasFilters = computed(() => {
    const { search, profile, status } = this.query();
    return Boolean(search || profile || status);
  });
  readonly errorMessage = computed(() => {
    const error = this.users.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly profileOptions = Object.entries(PROFILE_LABELS);
  protected readonly statusOptions = Object.entries(STATUS_LABELS);
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = PAGE_SIZE;

  // El buscador espera 300 ms (debounce) antes de avisar
  async handleSearch(event: CustomEvent<{ value?: string | null }>): Promise<void> {
    await this.handleFilter('search', event.detail.value);
  }

  // Cambiar un filtro vuelve a la primera página sin tocar los demás
  async handleFilter(key: FilterKey, value: string | null | undefined): Promise<void> {
    await this.navigate({ [key]: value || null, offset: null });
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
