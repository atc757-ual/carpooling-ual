import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { IonButton, IonCard, IonIcon, IonSkeletonText, ModalController } from '@ionic/angular';
import { checkmarkCircleOutline } from 'ionicons/icons';
import {
  AdminIncident,
  AdminIncidentQuery,
  INCIDENT_CATEGORIES,
  IncidentCategory,
} from '../../../core/models/admin-incident.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminIncidentsService } from '../../../core/services/admin/admin-incidents.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { confirmWithReason } from '../../../shared/components/modals/reason-confirm-modal/reason-confirm-modal';
import {
  FilterChipOption,
  FilterChips,
} from '../../../shared/components/ui/filter-chips/filter-chips';
import { ActiveFilter, FiltersCard } from '../../../shared/components/ui/filters-card/filters-card';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import {
  CATEGORY_LABELS,
  formatDateTime,
  incidentPeople,
  incidentRoute,
  severityOf,
  STATUS_FILTERS,
  StatusFilter,
} from './admin-incident-labels';

export const PAGE_SIZE = 20;
const RESOLUTION_MAX_LENGTH = 1000;
const CATEGORIES = new Set<string>(INCIDENT_CATEGORIES);
const STATUS_VALUES = new Set<string>(['open', 'reviewed', 'all']);
const SKELETON_CARDS = [1, 2, 3];
// Los que se quitan desde el resumen de «Más filtros» (el estado vuelve a
// «Abiertas», el de por defecto)
const CHIP_FILTERS = new Set<string>(['status', 'category']);

// Pide la resolución y revisa la incidencia; dice si se hizo
export function reviewWithResolution(
  modalController: ModalController,
  incidents: AdminIncidentsService,
  incident: AdminIncident,
): Promise<boolean> {
  return confirmWithReason(modalController, {
    header: '¿Marcar como revisada?',
    message: 'La revisión es definitiva y conserva el informe original.',
    confirmText: 'Marcar revisada',
    fieldLabel: 'Resolución',
    maxLength: RESOLUTION_MAX_LENGTH,
    action: async (resolution) => {
      await incidents.review(incident.id, resolution);
    },
  });
}

// Incidencias del panel (CU-12), como Usuarios: la lista con su paginación en
// la columna de 8 (la gravedad en el borde de cada fila y «Marcar revisada») y
// el estado (abiertas por defecto) y la categoría en la de 4 (en el móvil, tras
// «Más filtros»). Los filtros y la página van en la URL
@Component({
  selector: 'app-admin-incidents-page',
  imports: [
    FilterChips,
    FiltersCard,
    HeadingContent,
    IonButton,
    IonCard,
    IonIcon,
    IonSkeletonText,
    Pagination,
    RouterLink,
  ],
  templateUrl: './admin-incidents.page.html',
  styleUrl: './admin-incidents.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminIncidentsPage {
  private readonly incidents = inject(AdminIncidentsService);
  private readonly modalController = inject(ModalController);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Parámetros de la URL (withComponentInputBinding)
  readonly status = input<string>();
  readonly category = input<string>();
  readonly offset = input<string>();

  readonly statusFilter = computed<StatusFilter>(() => {
    const status = this.status();
    return status && STATUS_VALUES.has(status) ? (status as StatusFilter) : 'open';
  });
  readonly query = computed<AdminIncidentQuery>(() => {
    const category = this.category();
    const status = this.statusFilter();
    return {
      status: status === 'all' ? undefined : status,
      category: category && CATEGORIES.has(category) ? (category as IncidentCategory) : undefined,
      offset: Math.max(Number(this.offset()) || 0, 0),
      limit: PAGE_SIZE,
    };
  });

  readonly page = resource({
    params: () => this.query(),
    loader: ({ params }) => this.incidents.list(params),
  });

  readonly cards = computed(() =>
    (this.page.value()?.items ?? []).map((incident) => ({
      incident,
      title: CATEGORY_LABELS[incident.category],
      severity: severityOf(incident.category),
      date: formatDateTime(incident.reportedAt),
      people: incidentPeople(incident),
      route: incidentRoute(incident),
    })),
  );
  readonly total = computed(() => this.page.value()?.total ?? 0);
  // Lo que no es lo de por defecto (estado distinto de «Abiertas» y categoría),
  // para el resumen del móvil con «Más filtros» cerrado
  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const status = this.statusFilter();
    const { category } = this.query();
    const filters: ActiveFilter[] = [];
    if (status !== 'open') {
      const label = STATUS_FILTERS.find((filter) => filter.value === status)?.label ?? status;
      filters.push({ key: 'status', label });
    }
    if (category) {
      filters.push({ key: 'category', label: CATEGORY_LABELS[category] });
    }
    return filters;
  });
  readonly errorMessage = computed(() => {
    const error = this.page.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  protected readonly statusOptions: FilterChipOption[] = STATUS_FILTERS.map((filter) => ({
    value: filter.value,
    label: filter.label,
  }));
  // El punto de cada categoría, con el color de su gravedad
  protected readonly categoryOptions: FilterChipOption[] = INCIDENT_CATEGORIES.map((category) => ({
    value: category,
    label: CATEGORY_LABELS[category],
    tone: severityOf(category),
  }));
  protected readonly skeletonCards = SKELETON_CARDS;
  protected readonly pageSize = PAGE_SIZE;
  protected readonly emptyIcon = checkmarkCircleOutline;

  async handleStatus(value: unknown): Promise<void> {
    const status = typeof value === 'string' && value !== 'open' ? value : null;
    await this.navigate({ status, offset: null });
  }

  async handleCategory(value: unknown): Promise<void> {
    await this.navigate({
      category: typeof value === 'string' && value ? value : null,
      offset: null,
    });
  }

  async handleRemoveFilter(key: string): Promise<void> {
    if (CHIP_FILTERS.has(key)) {
      await this.navigate({ [key]: null, offset: null });
    }
  }

  async handleClearFilters(): Promise<void> {
    await this.navigate({ status: null, category: null, offset: null });
  }

  async handleOffset(offset: number): Promise<void> {
    await this.navigate({ offset: offset || null });
  }

  async handleReview(incident: AdminIncident): Promise<void> {
    if (await reviewWithResolution(this.modalController, this.incidents, incident)) {
      void this.toast.showSuccess('Incidencia revisada.');
      this.page.reload();
    }
  }

  handleRetry(): void {
    this.page.reload();
  }

  private async navigate(queryParams: Record<string, string | number | null>): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
