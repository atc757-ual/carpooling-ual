import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import type { SimulationRun } from '../entities/simulation-run.entity';
import { SWEEP_PARAMETERS } from '../sensitivity';
import type { SweepParameter } from '../sensitivity';
import { SIMULATION_RUN_STATUSES } from '../simulation-run-status';
import type { SimulationRunStatus } from '../simulation-run-status';
import type {
  SimulationSweep,
  SweepStatus,
} from '../simulation-sweeps.service';
import { simulationHref } from './simulation-run.resource';

export function simulationSweepHref(id: string): string {
  return `/${API_PREFIX}/admin/simulation-sweeps/${id}`;
}

// Una variante del barrido: su ejecución y, si ha terminado, lo que decide el
// criterio de éxito
class SweepVariantResource {
  @ApiProperty({ example: 0.3, description: 'Value of the parameter' })
  value: number;

  @ApiProperty({
    format: 'uuid',
    nullable: true,
    description: 'null until it starts',
  })
  runId: string | null;

  @ApiProperty({ nullable: true })
  runHref: string | null;

  @ApiProperty({ enum: SIMULATION_RUN_STATUSES, nullable: true })
  status: SimulationRunStatus | null;

  @ApiProperty({ example: 12, description: 'Finished replicas' })
  progress: number;

  @ApiProperty({ example: 16.2, nullable: true, description: 'Mean %' })
  vehiclesAvoidedPct: number | null;

  @ApiProperty({ example: 14.1, nullable: true, description: '95 % CI' })
  vehiclesAvoidedCiLow: number | null;

  @ApiProperty({ example: 18.3, nullable: true, description: '95 % CI' })
  vehiclesAvoidedCiHigh: number | null;

  @ApiProperty({ example: 72.5, nullable: true, description: 'Mean %' })
  requestsCoveredPct: number | null;

  @ApiProperty({ nullable: true, description: 'HE0 rejected (paired test)' })
  rejectsNull: boolean | null;

  @ApiProperty({ nullable: true })
  criterionMet: boolean | null;
}

export class SimulationSweepResource {
  @ApiProperty({ enum: ['SimulationSweep'] })
  '@type': 'SimulationSweep';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example:
      '/api/admin/simulation-sweeps/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ example: 'S1' })
  scenario: string;

  @ApiProperty({ example: 'S0' })
  baselineScenario: string;

  @ApiProperty({ enum: SWEEP_PARAMETERS })
  parameter: SweepParameter;

  @ApiProperty({ example: 30 })
  replicas: number;

  @ApiProperty({ example: 20261101 })
  seed: number;

  @ApiProperty({
    enum: ['running', 'finished', 'stopped'],
    description: 'stopped: a variant failed, was cancelled or could not start',
  })
  status: SweepStatus;

  @ApiProperty({ type: [SweepVariantResource] })
  variants: SweepVariantResource[];

  @ApiProperty({ format: 'date-time' })
  createdAt: string;
}

function toVariant(value: number, run?: SimulationRun): SweepVariantResource {
  const summary = run?.summary ?? null;
  return {
    value,
    runId: run?.id ?? null,
    runHref: run ? simulationHref(run.id) : null,
    status: run?.status ?? null,
    progress: run?.progress ?? 0,
    vehiclesAvoidedPct: summary?.vehiclesAvoidedPct.mean ?? null,
    vehiclesAvoidedCiLow: summary?.vehiclesAvoidedPct.ciLow ?? null,
    vehiclesAvoidedCiHigh: summary?.vehiclesAvoidedPct.ciHigh ?? null,
    requestsCoveredPct: summary?.requestsCoveredPct.mean ?? null,
    rejectsNull: summary?.vehiclesReduction?.rejectsNull ?? null,
    criterionMet: run?.criterionMet ?? null,
  };
}

export function toSimulationSweepResource(
  sweep: SimulationSweep,
): SimulationSweepResource {
  const [first] = sweep.runs;
  return {
    '@type': 'SimulationSweep',
    id: sweep.id,
    href: simulationSweepHref(sweep.id),
    scenario: first.scenarioConfig.scenario.code,
    baselineScenario: first.scenarioConfig.baseline.code,
    parameter: sweep.plan.parameter,
    replicas: first.replicas,
    seed: first.seed,
    status: sweep.status,
    variants: sweep.plan.values.map((value, index) =>
      toVariant(value, sweep.runs[index]),
    ),
    createdAt: first.createdAt.toISOString(),
  };
}
