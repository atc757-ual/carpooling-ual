import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  resource,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonInput,
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
} from '@ionic/angular';
import { SimulationRun } from '../../../core/models/admin-simulation.model';
import { ApiError } from '../../../core/models/api-error.model';
import { AdminSimulationsService } from '../../../core/services/admin/admin-simulations.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { HeadingContent } from '../../../shared/directives/heading-content.directive';
import { SimulationResultsView } from './simulation-results/simulation-results';
import {
  comparisonLabel,
  formatDateTime,
  formatNumber,
  isActive,
  runStatusLabel,
} from './simulation-labels';

const BASELINE = 'S0';
const DEFAULT_SCENARIO = 'S1';
const DEFAULT_SEED = 20261101;
const MAX_REPLICAS = 100;
const MAX_SEED = 2_147_483_647;
const POLL_MS = 2000;
const HISTORY_SIZE = 10;

function isWholeNumber(value: number, max: number, min = 0): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

// Simulación de escenarios del panel (RF-15 a RF-20, CU-09 y CU-10): configurar
// y lanzar un escenario frente a la base, seguir su progreso, ver sus
// resultados y el historial. La ejecución abierta va en la URL (?run=)
@Component({
  selector: 'app-admin-simulation-page',
  imports: [
    HeadingContent,
    IonButton,
    IonCard,
    IonInput,
    IonProgressBar,
    IonRadio,
    IonRadioGroup,
    SimulationResultsView,
  ],
  templateUrl: './admin-simulation.page.html',
  styleUrl: './admin-simulation.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSimulationPage {
  private readonly simulations = inject(AdminSimulationsService);
  private readonly confirm = inject(ConfirmService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  // Parámetro de la URL (withComponentInputBinding)
  readonly run = input<string>();

  readonly scenarios = resource({ loader: () => this.simulations.scenarios() });
  // Las últimas ejecuciones (el historial no necesita más)
  readonly history = resource({
    loader: () => this.simulations.list({ offset: 0, limit: HISTORY_SIZE }),
  });

  // La abierta en la URL o, si no, la más reciente
  readonly shownRunId = computed(() => this.run() ?? this.history.value()?.items[0]?.id);
  readonly shownRun = resource({
    params: () => this.shownRunId(),
    loader: ({ params }) => this.simulations.get(params),
  });
  readonly current = computed(() => (this.shownRun.hasValue() ? this.shownRun.value() : null));
  readonly results = resource({
    params: () => {
      const run = this.current();
      return run?.status === 'finished' ? run.id : undefined;
    },
    loader: ({ params }) => this.simulations.results(params),
  });

  // Formulario: S1 por defecto, con las réplicas de su escenario
  readonly scenario = linkedSignal(() => {
    const codes = (this.scenarios.value() ?? []).map(({ code }) => code);
    return codes.includes(DEFAULT_SCENARIO) ? DEFAULT_SCENARIO : (codes[0] ?? '');
  });
  readonly selectedScenario = computed(() =>
    this.scenarios.value()?.find(({ code }) => code === this.scenario()),
  );
  readonly replicas = linkedSignal(() => this.selectedScenario()?.replicas ?? 30);
  readonly seed = signal(DEFAULT_SEED);
  readonly isReplicasValid = computed(() => isWholeNumber(this.replicas(), MAX_REPLICAS, 1));
  readonly isSeedValid = computed(() => isWholeNumber(this.seed(), MAX_SEED));
  readonly startLabel = computed(() => `Ejecutar ${this.scenario()} frente a ${BASELINE}`);
  readonly isStarting = signal(false);
  readonly startError = signal<string | null>(null);

  readonly isRunning = computed(() => {
    const run = this.current();
    return run !== null && isActive(run);
  });
  readonly progressLabel = computed(() => {
    const run = this.current();
    return run ? `${run.progress}/${run.replicas} réplicas` : '';
  });
  readonly snapshotLabel = computed(() => {
    const run = this.current();
    return run ? formatDateTime(run.snapshotAt) : null;
  });
  readonly historyRows = computed(() =>
    (this.history.value()?.items ?? []).map((run) => ({
      run,
      date: formatDateTime(run.requestedAt),
      comparison: comparisonLabel(run),
      status: runStatusLabel(run.status),
      criterion: criterionLabel(run),
    })),
  );

  protected readonly text = { formatNumber };

  constructor() {
    // Mientras la ejecución abierta está en marcha, se consulta cada 2 s; al
    // terminar, se recarga el historial. Se para al salir de la pantalla
    effect(() => {
      if (this.isRunning()) {
        this.startPolling();
      } else if (this.pollTimer !== null) {
        this.stopPolling();
        this.history.reload();
      }
    });
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  handleScenario(code: unknown): void {
    if (typeof code === 'string') {
      this.scenario.set(code);
    }
  }

  handleNumber(target: 'replicas' | 'seed', event: CustomEvent<{ value?: string | null }>): void {
    const value = Number(event.detail.value);
    this[target].set(Number.isFinite(value) ? value : Number.NaN);
  }

  async handleStart(): Promise<void> {
    if (!this.isReplicasValid() || !this.isSeedValid() || this.isStarting()) {
      return;
    }
    this.isStarting.set(true);
    this.startError.set(null);
    try {
      const run = await this.simulations.start({
        scenario: this.scenario(),
        baselineScenario: BASELINE,
        replicas: this.replicas(),
        seed: this.seed(),
      });
      this.history.reload();
      await this.openRun(run.id);
    } catch (error) {
      this.startError.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isStarting.set(false);
    }
  }

  async handleCancel(): Promise<void> {
    const run = this.current();
    const isConfirmed = await this.confirm.ask({
      header: '¿Cancelar la ejecución?',
      message: 'Se perderán las réplicas hechas hasta ahora.',
      confirmText: 'Cancelar ejecución',
      cancelText: 'Seguir',
      isDestructive: true,
    });
    if (run && isConfirmed) {
      await this.simulations.cancel(run.id).catch(() => undefined);
      this.shownRun.reload();
    }
  }

  // El CSV con el token de la sesión: se descarga como blob
  async handleExport(): Promise<void> {
    const run = this.current();
    if (!run) {
      return;
    }
    const blob = await this.simulations.csv(run.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `simulacion-${run.scenario}-${run.seed}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async openRun(runId: string): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { run: runId },
      queryParamsHandling: 'merge',
    });
  }

  private startPolling(): void {
    this.pollTimer ??= setInterval(() => this.shownRun.reload(), POLL_MS);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

function criterionLabel(run: SimulationRun): string {
  if (run.criterionMet === null) {
    return '—';
  }
  return run.criterionMet ? 'Cumplido' : 'No cumplido';
}
