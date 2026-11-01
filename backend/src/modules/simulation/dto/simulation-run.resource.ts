import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import type { SimulationRun } from '../entities/simulation-run.entity';
import { SIMULATION_RUN_STATUSES } from '../simulation-run-status';
import type { SimulationRunStatus } from '../simulation-run-status';
import { ScenarioConfigResource } from './scenario.resource';

class RunScenarioConfigResource {
  @ApiProperty({ type: ScenarioConfigResource })
  scenario: ScenarioConfigResource;

  @ApiProperty({ type: ScenarioConfigResource })
  baseline: ScenarioConfigResource;
}

export class SimulationRunResource {
  @ApiProperty({ enum: ['SimulationRun'] })
  '@type': 'SimulationRun';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/admin/simulations/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ example: 'S1', description: 'Scenario code' })
  scenario: string;

  @ApiProperty({ example: 'S0', description: 'Baseline scenario code' })
  baselineScenario: string;

  @ApiProperty({
    type: RunScenarioConfigResource,
    description: 'Copy of both configurations when the run was requested',
  })
  scenarioConfig: RunScenarioConfigResource;

  @ApiProperty({ example: 30 })
  replicas: number;

  @ApiProperty({ example: 20261101 })
  seed: number;

  @ApiProperty({ enum: SIMULATION_RUN_STATUSES })
  status: SimulationRunStatus;

  @ApiProperty({ example: 12, description: 'Finished replicas' })
  progress: number;

  @ApiProperty({ format: 'uuid', nullable: true, type: String })
  requestedBy: string | null;

  @ApiProperty({ format: 'date-time' })
  snapshotAt: string;

  @ApiProperty({ format: 'date-time' })
  requestedAt: string;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  startedAt: string | null;

  @ApiProperty({ format: 'date-time', nullable: true, type: String })
  finishedAt: string | null;

  @ApiProperty({ example: null, nullable: true, type: String })
  errorCode: string | null;

  @ApiProperty({
    nullable: true,
    type: Boolean,
    description:
      'Success criterion (>= 15 % fewer vehicles and >= 70 % requests covered); null until finished',
  })
  criterionMet: boolean | null;
}

export function simulationHref(id: string): string {
  return `/${API_PREFIX}/admin/simulations/${id}`;
}

export function toSimulationRunResource(
  run: SimulationRun,
): SimulationRunResource {
  return {
    '@type': 'SimulationRun',
    id: run.id,
    href: simulationHref(run.id),
    scenario: run.scenarioConfig.scenario.code,
    baselineScenario: run.scenarioConfig.baseline.code,
    scenarioConfig: run.scenarioConfig,
    replicas: run.replicas,
    seed: run.seed,
    status: run.status,
    progress: run.progress,
    requestedBy: run.requestedBy,
    snapshotAt: run.snapshotAt.toISOString(),
    requestedAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    errorCode: run.errorCode,
    criterionMet: run.criterionMet,
  };
}
