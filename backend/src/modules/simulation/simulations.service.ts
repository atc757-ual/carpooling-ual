import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  LessThan,
  QueryFailedError,
  Repository,
} from 'typeorm';
import type { DomainEventType } from '../../events/domain-event-type';
import { EventsService } from '../../events/events.service';
import { Page, PageRequest } from '../../shared/pagination/page';
import { Scenario } from './entities/scenario.entity';
import {
  SimulationResult,
  toReplicaMetrics,
  toResultRow,
} from './entities/simulation-result.entity';
import { SimulationRun } from './entities/simulation-run.entity';
import { ScenarioNotFoundError } from './errors/scenario-not-found.error';
import { SimulationAlreadyRunningError } from './errors/simulation-already-running.error';
import { SimulationNotFinishedError } from './errors/simulation-not-finished.error';
import { SimulationNotFoundError } from './errors/simulation-not-found.error';
import { SIMULATION_RUNNER } from './runner/simulation-runner';
import type {
  SimulationRunListener,
  SimulationRunner,
} from './runner/simulation-runner';
import { toScenarioConfig } from './scenario-config';
import { applyVariant } from './sensitivity';
import type { SweepPlan, SweepVariant } from './sensitivity';
import { aggregate, toCsv } from './simulation-metrics';
import type { SimulationOutput } from './simulation-metrics';
import {
  ACTIVE_RUN_STATUSES,
  assertTransition,
  canTransition,
} from './simulation-run-status';
import type { SimulationRunStatus } from './simulation-run-status';

export interface StartSimulationInput {
  scenarioCode: string;
  baselineCode: string;
  // Sin indicar, las réplicas por defecto del escenario
  replicas?: number;
  seed: number;
  // Solo en un análisis de sensibilidad
  sweep?: { id: string; plan: SweepPlan; variant: SweepVariant };
}

// Quien quiere saber cuándo termina una ejecución, bien o mal (p. ej. el
// barrido, para lanzar la siguiente variante): patrón observador
export type RunEndedListener = (run: SimulationRun) => Promise<void>;

const ENDED_STATUSES: ReadonlySet<SimulationRunStatus> = new Set([
  'finished',
  'failed',
  'cancelled',
]);

// Sin noticias del motor durante este tiempo, la ejecución se da por perdida
// (p. ej. se reinició el servidor con el motor falso a medias)
const STALE_AFTER_MS = 60_000;
const STALE_ERROR_CODE = 'RUNNER_LOST';
const ONE_ACTIVE_INDEX = 'simulation_runs_one_active_idx';

// Eventos de los cambios de estado que pide el motor (el paso a en curso no
// lleva evento: solo cambia el progreso)
const ENGINE_EVENTS: Partial<Record<SimulationRunStatus, DomainEventType>> = {
  finished: 'simulation.finished',
  failed: 'simulation.failed',
};

// Ejecuciones de simulación (RF-15 a RF-18, CU-09, CU-10). Registra cada
// ejecución y sus cambios de estado (con su evento outbox) y delega el cálculo
// en el SimulationRunner, del que recibe el progreso y los resultados
@Injectable()
export class SimulationsService implements SimulationRunListener {
  private readonly endedListeners: RunEndedListener[] = [];

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Scenario)
    private readonly scenariosRepository: Repository<Scenario>,
    @InjectRepository(SimulationRun)
    private readonly runsRepository: Repository<SimulationRun>,
    @InjectRepository(SimulationResult)
    private readonly resultsRepository: Repository<SimulationResult>,
    private readonly eventsService: EventsService,
    @Inject(SIMULATION_RUNNER) private readonly runner: SimulationRunner,
  ) {}

  listScenarios(): Promise<Scenario[]> {
    return this.scenariosRepository.find({ order: { code: 'ASC' } });
  }

  onRunEnded(listener: RunEndedListener): void {
    this.endedListeners.push(listener);
  }

  // adminId null: lanzada por el sistema (la siguiente variante de un barrido
  // cuyo administrador ya no consta)
  async start(
    adminId: string | null,
    input: StartSimulationInput,
  ): Promise<SimulationRun> {
    const scenario = await this.findScenario(input.scenarioCode);
    const baseline = await this.findScenario(input.baselineCode);
    await this.failStaleRuns();
    const configs = {
      scenario: toScenarioConfig(scenario),
      baseline: toScenarioConfig(baseline),
    };
    const { sweep } = input;
    const run = await this.dataSource
      .transaction(async (manager) => {
        const created = await manager.save(
          manager.create(SimulationRun, {
            scenarioId: scenario.id,
            baselineScenarioId: baseline.id,
            scenarioConfig: sweep
              ? {
                  ...applyVariant(configs, sweep.variant),
                  variant: sweep.variant,
                  sweep: sweep.plan,
                }
              : configs,
            sweepId: sweep?.id ?? null,
            replicas: input.replicas ?? scenario.replicas,
            seed: input.seed,
            requestedBy: adminId,
            snapshotAt: new Date(),
          }),
        );
        await this.recordEvent(
          manager,
          'simulation.requested',
          created,
          adminId,
        );
        return created;
      })
      .catch((error: unknown) => {
        throw isOneActiveViolation(error)
          ? new SimulationAlreadyRunningError()
          : error;
      });
    this.runner.start(
      {
        runId: run.id,
        scenario: run.scenarioConfig.scenario,
        baseline: run.scenarioConfig.baseline,
        replicas: run.replicas,
        seed: run.seed,
      },
      this,
    );
    return run;
  }

  async list(page: PageRequest): Promise<Page<SimulationRun>> {
    await this.failStaleRuns();
    const [items, total] = await this.runsRepository.findAndCount({
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: page.offset,
      take: page.limit,
    });
    return { items, total };
  }

  async get(runId: string): Promise<SimulationRun> {
    // Al consultarla: si no, una ejecución perdida (p. ej. por un reinicio) se
    // vería en curso para siempre y no dejaría lanzar otra desde el panel
    await this.failStaleRuns();
    const run = await this.runsRepository.findOneBy({ id: runId });
    if (run === null) {
      throw new SimulationNotFoundError(runId);
    }
    return run;
  }

  async getFinished(runId: string): Promise<SimulationRun> {
    const run = await this.get(runId);
    if (run.status !== 'finished') {
      throw new SimulationNotFinishedError(runId);
    }
    return run;
  }

  async exportCsv(runId: string): Promise<string> {
    await this.getFinished(runId);
    const rows = await this.resultsRepository.find({
      where: { runId },
      order: { replica: 'ASC' },
    });
    return toCsv(rows.map(toReplicaMetrics));
  }

  async cancel(adminId: string, runId: string): Promise<SimulationRun> {
    const run = await this.dataSource.transaction(async (manager) => {
      const current = await this.lockRun(manager, runId);
      assertTransition(current.status, 'cancelled');
      current.status = 'cancelled';
      current.finishedAt = new Date();
      const cancelled = await manager.save(current);
      await this.recordEvent(
        manager,
        'simulation.cancelled',
        cancelled,
        adminId,
      );
      return cancelled;
    });
    this.runner.cancel(runId);
    await this.notifyEnded(run);
    return run;
  }

  // --- Avisos del motor (SimulationRunListener)

  async onStarted(runId: string): Promise<void> {
    await this.transition(runId, 'running', (run) => {
      run.startedAt = new Date();
    });
  }

  async onProgress(runId: string, completedReplicas: number): Promise<void> {
    await this.runsRepository.update(
      { id: runId, status: 'running' },
      { progress: completedReplicas },
    );
  }

  async onFinished(runId: string, output: SimulationOutput): Promise<void> {
    const { summary, series, criterionMet } = aggregate(output);
    await this.transition(runId, 'finished', async (run, manager) => {
      run.finishedAt = new Date();
      run.criterionMet = criterionMet;
      run.summary = summary;
      run.series = series;
      run.progress = output.replicas.length;
      await manager.insert(
        SimulationResult,
        output.replicas.map((metrics) =>
          toResultRow(runId, run.scenarioId, metrics),
        ),
      );
    });
  }

  async onFailed(runId: string, errorCode: string): Promise<void> {
    await this.transition(runId, 'failed', (run) => {
      run.finishedAt = new Date();
      run.errorCode = errorCode;
    });
  }

  // Aplica un cambio de estado pedido por el motor. Si ya no se puede (p. ej.
  // el admin la canceló mientras terminaba una réplica), se ignora
  private async transition(
    runId: string,
    to: SimulationRunStatus,
    apply: (run: SimulationRun, manager: EntityManager) => void | Promise<void>,
  ): Promise<void> {
    const saved = await this.dataSource.transaction(async (manager) => {
      const run = await this.lockRun(manager, runId);
      if (!canTransition(run.status, to)) {
        return null;
      }
      run.status = to;
      await apply(run, manager);
      const changed = await manager.save(run);
      const eventType = ENGINE_EVENTS[to];
      if (eventType !== undefined) {
        await this.recordEvent(manager, eventType, changed, null);
      }
      return changed;
    });
    if (saved !== null && ENDED_STATUSES.has(to)) {
      await this.notifyEnded(saved);
    }
  }

  // Ya confirmada la transacción: el siguiente paso (p. ej. otra variante)
  // puede lanzar una ejecución nueva
  private async notifyEnded(run: SimulationRun): Promise<void> {
    for (const listener of this.endedListeners) {
      await listener(run);
    }
  }

  private async findScenario(code: string): Promise<Scenario> {
    const scenario = await this.scenariosRepository.findOneBy({ code });
    if (scenario === null) {
      throw new ScenarioNotFoundError(code);
    }
    return scenario;
  }

  private async failStaleRuns(): Promise<void> {
    const stale = await this.runsRepository.findBy({
      status: In(ACTIVE_RUN_STATUSES),
      updatedAt: LessThan(new Date(Date.now() - STALE_AFTER_MS)),
    });
    await Promise.all(
      stale.map((run) => this.onFailed(run.id, STALE_ERROR_CODE)),
    );
  }

  private async lockRun(
    manager: EntityManager,
    runId: string,
  ): Promise<SimulationRun> {
    const run = await manager.findOne(SimulationRun, {
      where: { id: runId },
      lock: { mode: 'pessimistic_write' },
    });
    if (run === null) {
      throw new SimulationNotFoundError(runId);
    }
    return run;
  }

  // El evento lleva el estado de la ejecución (sin el resumen) y, en las
  // acciones de un administrador, su id (auditoría: quién, qué y cuándo)
  private async recordEvent(
    manager: EntityManager,
    type: DomainEventType,
    run: SimulationRun,
    adminId: string | null,
  ): Promise<void> {
    await this.eventsService.record(manager, {
      type,
      sourceEntityId: run.id,
      payload: {
        adminId,
        scenarioId: run.scenarioId,
        baselineScenarioId: run.baselineScenarioId,
        scenario: run.scenarioConfig.scenario.code,
        baselineScenario: run.scenarioConfig.baseline.code,
        replicas: run.replicas,
        seed: run.seed,
        status: run.status,
        progress: run.progress,
        errorCode: run.errorCode,
        criterionMet: run.criterionMet,
      },
    });
  }
}

function isOneActiveViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { constraint?: string }).constraint ===
      ONE_ACTIVE_INDEX
  );
}
