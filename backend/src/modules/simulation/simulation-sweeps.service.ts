import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Page, PageRequest } from '../../shared/pagination/page';
import { SimulationRun } from './entities/simulation-run.entity';
import { SimulationAlreadyRunningError } from './errors/simulation-already-running.error';
import { SimulationSweepNotFoundError } from './errors/simulation-sweep-not-found.error';
import { nextVariant } from './sensitivity';
import type { SweepParameter, SweepPlan } from './sensitivity';
import { ACTIVE_RUN_STATUSES } from './simulation-run-status';
import { SimulationsService } from './simulations.service';
import type { StartSimulationInput } from './simulations.service';

export type SweepStatus = 'running' | 'finished' | 'stopped';

export interface StartSweepInput extends Omit<StartSimulationInput, 'sweep'> {
  parameter: SweepParameter;
  values: number[];
}

// Un barrido: sus ejecuciones, en el orden de las variantes
export interface SimulationSweep {
  id: string;
  plan: SweepPlan;
  status: SweepStatus;
  runs: SimulationRun[];
}

const ACTIVE: ReadonlySet<string> = new Set(ACTIVE_RUN_STATUSES);

// En curso mientras quede alguna variante por terminar y la última siga viva;
// parado si una falló, se canceló o no se pudo lanzar la siguiente
export function sweepStatus(
  plan: SweepPlan,
  runs: SimulationRun[],
): SweepStatus {
  const finished = runs.filter((run) => run.status === 'finished').length;
  if (finished === plan.values.length) {
    return 'finished';
  }
  const last = runs.at(-1);
  return last !== undefined && ACTIVE.has(last.status) ? 'running' : 'stopped';
}

// Análisis de sensibilidad (capítulo 11, paso 5): lanza la primera variante y,
// cada vez que una termina bien, la siguiente. Cada variante es una ejecución
// normal (con su evento, sus resultados y su CSV); el barrido las agrupa
@Injectable()
export class SimulationSweepsService {
  private readonly logger = new Logger(SimulationSweepsService.name);

  constructor(
    private readonly simulationsService: SimulationsService,
    @InjectRepository(SimulationRun)
    private readonly runsRepository: Repository<SimulationRun>,
  ) {
    simulationsService.onRunEnded((run) => this.handleRunEnded(run));
  }

  async start(
    adminId: string,
    input: StartSweepInput,
  ): Promise<SimulationSweep> {
    const { parameter, values, ...run } = input;
    const plan: SweepPlan = { parameter, values };
    const id = randomUUID();
    await this.simulationsService.start(adminId, {
      ...run,
      sweep: { id, plan, variant: { parameter, value: values[0] } },
    });
    return this.get(id);
  }

  async get(sweepId: string): Promise<SimulationSweep> {
    const runs = await this.runsRepository.find({
      where: { sweepId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const plan = runs[0]?.scenarioConfig.sweep;
    if (plan === undefined) {
      throw new SimulationSweepNotFoundError(sweepId);
    }
    return { id: sweepId, plan, status: sweepStatus(plan, runs), runs };
  }

  // Los barridos, el más reciente primero
  async list(page: PageRequest): Promise<Page<SimulationSweep>> {
    const query = this.runsRepository
      .createQueryBuilder('run')
      .select('run.sweep_id', 'id')
      .addSelect('MIN(run.created_at)', 'created')
      .where('run.sweep_id IS NOT NULL')
      .groupBy('run.sweep_id');
    const total = (await query.clone().getRawMany()).length;
    const ids = await query
      .orderBy('created', 'DESC')
      .addOrderBy('id', 'ASC')
      .offset(page.offset)
      .limit(page.limit)
      .getRawMany<{ id: string }>();
    const items = await Promise.all(ids.map(({ id }) => this.get(id)));
    return { items, total };
  }

  private async handleRunEnded(run: SimulationRun): Promise<void> {
    const plan = run.scenarioConfig.sweep;
    if (run.sweepId === null || plan === undefined) {
      return;
    }
    if (run.status !== 'finished') {
      return;
    }
    const done = await this.runsRepository.countBy({ sweepId: run.sweepId });
    const variant = nextVariant(plan, done);
    if (variant === null) {
      return;
    }
    try {
      await this.simulationsService.start(run.requestedBy, {
        scenarioCode: run.scenarioConfig.scenario.code,
        baselineCode: run.scenarioConfig.baseline.code,
        replicas: run.replicas,
        seed: run.seed,
        sweep: { id: run.sweepId, plan, variant },
      });
    } catch (error) {
      // Otra ejecución se ha colado entre medias: el barrido queda parado
      if (!(error instanceof SimulationAlreadyRunningError)) {
        throw error;
      }
      this.logger.warn(`Sweep ${run.sweepId} stopped: another run is active`);
    }
  }
}
