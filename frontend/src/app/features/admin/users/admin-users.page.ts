import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  resource,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonChip,
  IonIcon,
  IonSearchbar,
  IonSkeletonText,
} from '@ionic/angular';
import { chevronDownOutline, closeOutline, optionsOutline } from 'ionicons/icons';
import {
  ADMIN_USER_STATUSES,
  AdminUserQuery,
  AdminUserStatus,
} from '../../../core/models/admin-user.model';
import { ApiError } from '../../../core/models/api-error.model';
import { Profile } from '../../../core/models/user.model';
import { AdminUsersService } from '../../../core/services/admin/admin-users.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  initials,
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

// Un filtro aplicado (menos el buscador), para quitarlo con un toque
interface ActiveFilter {
  key: Exclude<FilterKey, 'search'>;
  label: string;
}

// Usuarios del panel (RF-25, CU-13): la tabla con su estado y paginación en
// la columna de 8 y el buscador y los filtros en la de 4. En el móvil, el
// buscador arriba y el resto de filtros tras «Más filtros», y cada fila como
// una tarjeta. Los filtros y la página van en la URL (?search=&profile=…),
// así se conservan al volver del detalle
@Component({
  selector: 'app-admin-users-page',
  imports: [
    IonButton,
    IonCard,
    IonChip,
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
  private readonly headingContent = inject(HeadingContentService);
  private readonly heading = viewChild.required<TemplateRef<unknown>>('heading');

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
      initials: initials(row.name),
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
  // «Más filtros» abierto en el móvil (en escritorio se ven siempre)
  readonly areFiltersOpen = signal(false);
  readonly errorMessage = computed(() => {
    const error = this.users.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly profileOptions = Object.entries(PROFILE_LABELS);
  protected readonly statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
    tone: STATUS_TONES[value as AdminUserStatus],
  }));
  protected readonly skeletonRows = SKELETON_ROWS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly filtersIcon = optionsOutline;
  protected readonly toggleIcon = chevronDownOutline;
  protected readonly removeIcon = closeOutline;

  constructor() {
    // La franja del título, con el buscador, en la cabecera del panel
    effect(() => this.headingContent.show(this.heading()));
    inject(DestroyRef).onDestroy(() => this.headingContent.clear(this.heading()));
  }

  toggleFilters(): void {
    this.areFiltersOpen.update((isOpen) => !isOpen);
  }

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
