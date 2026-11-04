import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonButton, IonSelect, IonSelectOption, IonSkeletonText } from '@ionic/angular';
import { AdminEventQuery } from '../../../core/models/admin-event.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminOverviewService } from '../../../core/services/admin/admin-overview.service';
import { Pagination } from '../../../shared/components/ui/pagination/pagination';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { formatDateTime } from '../incidents/admin-incident-labels';
import { EventPayload } from './event-payload';
import {
  EVENT_TYPE_GROUPS,
  eventEntityLabel,
  eventTypeLabel,
  isKnownEventType,
  overviewKpis,
} from './event-labels';
import { twinKpis, twinSync } from './twin-kpis';

export const PAGE_SIZE = 20;
// El resumen se refresca solo mientras la pantalla está abierta
export const OVERVIEW_REFRESH_MS = 30_000;
const SKELETON_KPIS = [1, 2, 3, 4, 5];

function errorMessageOf(error: unknown): string | null {
  return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
}

// Gemelo digital del panel: el estado del gemelo vivo (vehículos, viajes,
// usuarios y su sincronización), el resumen en
// vivo de la plataforma y sus últimos eventos, con el payload al desplegar
// cada uno. El tipo y la página van en la URL, como en Incidencias
@Component({
  selector: 'app-admin-digital-twin-page',
  imports: [IonButton, IonSelect, IonSelectOption, IonSkeletonText, EventPayload, Pagination],
  templateUrl: './admin-digital-twin.page.html',
  styleUrl: './admin-digital-twin.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDigitalTwinPage {
  private readonly overviewService = inject(AdminOverviewService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // Parámetros de la URL (withComponentInputBinding)
  readonly type = input<string>();
  readonly offset = input<string>();

  readonly overview = resource({ loader: () => this.overviewService.overview() });
  readonly kpis = computed(() => {
    const overview = this.overview.value();
    return overview ? overviewKpis(overview) : [];
  });
  readonly overviewError = computed(() => errorMessageOf(this.overview.error()));

  readonly twin = resource({ loader: () => this.overviewService.digitalTwin() });
  readonly twinKpis = computed(() => {
    const state = this.twin.value();
    return state ? twinKpis(state) : [];
  });
  readonly twinSync = computed(() => {
    const state = this.twin.value();
    return state ? twinSync(state) : null;
  });
  readonly twinError = computed(() => errorMessageOf(this.twin.error()));

  readonly query = computed<AdminEventQuery>(() => {
    const type = this.type();
    return {
      type: type && isKnownEventType(type) ? type : undefined,
      offset: Math.max(Number(this.offset()) || 0, 0),
      limit: PAGE_SIZE,
    };
  });
  readonly events = resource({
    params: () => this.query(),
    loader: ({ params }) => this.overviewService.listEvents(params),
  });
  readonly rows = computed(() =>
    (this.events.value()?.items ?? []).map((event) => ({
      id: event.id,
      type: eventTypeLabel(event.type),
      entity: eventEntityLabel(event.type, event.sourceEntityId),
      date: formatDateTime(event.occurredAt),
    })),
  );
  readonly total = computed(() => this.events.value()?.total ?? 0);
  readonly eventsError = computed(() => errorMessageOf(this.events.error()));

  // El evento desplegado (uno a la vez)
  readonly expandedId = signal<string | null>(null);

  protected readonly typeGroups = EVENT_TYPE_GROUPS;
  protected readonly skeletonKpis = SKELETON_KPIS;
  protected readonly pageSize = PAGE_SIZE;

  constructor() {
    const timer = setInterval(() => {
      this.overview.reload();
      this.twin.reload();
    }, OVERVIEW_REFRESH_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }

  handleRefresh(): void {
    this.twin.reload();
    this.overview.reload();
    this.events.reload();
  }

  handleToggle(eventId: string): void {
    this.expandedId.update((current) => (current === eventId ? null : eventId));
  }

  async handleType(value: unknown): Promise<void> {
    await this.navigate({ type: typeof value === 'string' && value ? value : null, offset: null });
  }

  async handleOffset(offset: number): Promise<void> {
    await this.navigate({ offset: offset || null });
  }

  private async navigate(queryParams: Record<string, string | number | null>): Promise<void> {
    this.expandedId.set(null);
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
