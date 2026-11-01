import { ApiProperty } from '@nestjs/swagger';
import type { SimulationRun } from '../entities/simulation-run.entity';
import { simulationHref } from './simulation-run.resource';

class MetricStatResource {
  @ApiProperty({ example: 18.4 })
  mean: number;

  @ApiProperty({ example: 1.2, description: 'Standard deviation' })
  sd: number;

  @ApiProperty({ example: 17.95, description: 'Lower bound of the 95 % CI' })
  ciLow: number;

  @ApiProperty({ example: 18.85, description: 'Upper bound of the 95 % CI' })
  ciHigh: number;
}

class ComparedStatResource {
  @ApiProperty({ type: MetricStatResource })
  scenario: MetricStatResource;

  @ApiProperty({ type: MetricStatResource })
  baseline: MetricStatResource;
}

// Métricas de RF-18 agregadas entre réplicas
class SimulationSummaryResource {
  @ApiProperty({ type: ComparedStatResource })
  vehiclesUsed: ComparedStatResource;

  @ApiProperty({ type: ComparedStatResource, description: 'People per car' })
  averageOccupancy: ComparedStatResource;

  @ApiProperty({ type: MetricStatResource })
  vehiclesAvoidedPct: MetricStatResource;

  @ApiProperty({ type: MetricStatResource })
  requestsCoveredPct: MetricStatResource;

  @ApiProperty({ type: MetricStatResource })
  matchingP95Ms: MetricStatResource;

  @ApiProperty({
    type: MetricStatResource,
    nullable: true,
    description: 'Only in scenarios with incidents (S5)',
  })
  recoveryPct: MetricStatResource | null;
}

class SlotSeriesResource {
  @ApiProperty({ example: '08:00' })
  slot: string;

  @ApiProperty({
    example: 42.5,
    description: 'Mean vehicles arriving in the scenario',
  })
  vehicles: number;

  @ApiProperty({
    example: 51.3,
    description: 'Mean vehicles arriving in the baseline',
  })
  baselineVehicles: number;
}

export class SimulationResultsResource {
  @ApiProperty({ enum: ['SimulationResults'] })
  '@type': 'SimulationResults';

  @ApiProperty({
    example:
      '/api/admin/simulations/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90/results',
  })
  href: string;

  @ApiProperty({ example: 30 })
  replicas: number;

  @ApiProperty()
  criterionMet: boolean;

  @ApiProperty({ type: SimulationSummaryResource })
  summary: SimulationSummaryResource;

  @ApiProperty({ type: [SlotSeriesResource] })
  series: SlotSeriesResource[];
}

// Solo para ejecuciones terminadas, que siempre tienen resumen y serie
export function toSimulationResultsResource(
  run: SimulationRun,
): SimulationResultsResource {
  return {
    '@type': 'SimulationResults',
    href: `${simulationHref(run.id)}/results`,
    replicas: run.progress,
    criterionMet: run.criterionMet ?? false,
    summary: run.summary as SimulationSummaryResource,
    series: run.series ?? [],
  };
}
