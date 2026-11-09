import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  resource,
  signal,
} from '@angular/core';
import {
  IonButton,
  IonInput,
  IonLabel,
  IonProgressBar,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import { SweepParameter } from '../../../../core/models/admin-simulation.model';
import { ApiError } from '../../../../core/models/api-error.model';
import { AdminSimulationSweepsService } from '../../../../core/services/admin/admin-simulation-sweeps.service';
import { getErrorMessage } from '../../../../shared/utils/error-message.util';
import { SensitivityChart } from './sensitivity-chart';
import {
  DEFAULT_VALUES,
  parseValues,
  sweepProgress,
  sweepProgressLabel,
  sweepRow,
} from './sweep-labels';

const BASELINE = 'S0';
const POLL_MS = 2000;

// Análisis de sensibilidad (capítulo 11): el escenario elegido arriba se
// repite con varios valores de un supuesto (% en coche o adopción), una
// ejecución por valor y con las mismas semillas. Muestra el último barrido:
// su progreso y, al terminar, el gráfico y la tabla
@Component({
  selector: 'app-sensitivity-sweep',
  imports: [
    IonButton,
    IonInput,
    IonLabel,
    IonProgressBar,
    IonSegment,
    IonSegmentButton,
    SensitivityChart,
  ],
  templateUrl: './sensitivity-sweep.html',
  styleUrl: './sensitivity-sweep.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SensitivitySweep {
  private readonly sweeps = inject(AdminSimulationSweepsService);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  // Del formulario de la página
  readonly scenario = input.required<string>();
  readonly replicas = input.required<number>();
  readonly seed = input.required<number>();
  // Otra ejecución en marcha: el simulador atiende una a la vez
  readonly isBlocked = input(false);
  readonly started = output<void>();

  readonly parameter = signal<SweepParameter>('ownCarShare');
  readonly valuesText = linkedSignal(() => DEFAULT_VALUES[this.parameter()]);
  readonly values = computed(() => parseValues(this.valuesText()));
  readonly isStarting = signal(false);
  readonly startError = signal<string | null>(null);

  // El barrido lanzado aquí o, si no, el más reciente
  private readonly sweepId = signal<string | null>(null);
  readonly sweep = resource({
    params: () => ({ id: this.sweepId() }),
    loader: ({ params }) => (params.id ? this.sweeps.get(params.id) : this.sweeps.latest()),
  });
  readonly current = computed(() => (this.sweep.hasValue() ? this.sweep.value() : null));
  readonly isRunning = computed(() => this.current()?.status === 'running');
  readonly progressLabel = computed(() => {
    const sweep = this.current();
    return sweep ? sweepProgressLabel(sweep) : '';
  });
  readonly progress = computed(() => {
    const sweep = this.current();
    return sweep ? sweepProgress(sweep) : 0;
  });
  readonly rows = computed(() => this.current()?.variants.map(sweepRow) ?? []);
  readonly startLabel = computed(() => `Analizar ${this.scenario()} con estos valores`);
  readonly canStart = computed(
    () =>
      this.values() !== null &&
      this.scenario() !== '' &&
      !this.isBlocked() &&
      !this.isRunning() &&
      !this.isStarting(),
  );

  constructor() {
    // Mientras el barrido está en marcha, se consulta cada 2 s
    effect(() => {
      if (this.isRunning()) {
        this.pollTimer ??= setInterval(() => this.sweep.reload(), POLL_MS);
      } else {
        this.stopPolling();
      }
    });
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  handleParameter(value: unknown): void {
    if (value === 'ownCarShare' || value === 'adoptionRate') {
      this.parameter.set(value);
    }
  }

  handleValues(event: CustomEvent<{ value?: string | null }>): void {
    this.valuesText.set(event.detail.value ?? '');
  }

  async handleStart(): Promise<void> {
    const values = this.values();
    if (!this.canStart() || values === null) {
      return;
    }
    this.isStarting.set(true);
    this.startError.set(null);
    try {
      const sweep = await this.sweeps.start({
        scenario: this.scenario(),
        baselineScenario: BASELINE,
        replicas: this.replicas(),
        seed: this.seed(),
        parameter: this.parameter(),
        values,
      });
      this.sweepId.set(sweep.id);
      this.started.emit();
    } catch (error) {
      this.startError.set(getErrorMessage(ApiError.fromHttpError(error)));
    } finally {
      this.isStarting.set(false);
    }
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
