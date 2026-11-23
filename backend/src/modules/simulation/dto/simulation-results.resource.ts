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

class WilcoxonResource {
  @ApiProperty({ example: 28, description: 'Pairs with a non-zero difference' })
  pairs: number;

  @ApiProperty({ example: 4.2, description: 'Normal approximation, one-sided' })
  z: number;

  @ApiProperty()
  rejectsNull: boolean;
}

// Contraste de la hipótesis experimental (HE1 frente a HE0) sobre las
// réplicas emparejadas
class PairedTestResource {
  @ApiProperty({
    example: 0.01,
    description: 'Bonferroni: 0.05 / 5 comparisons, one-sided',
  })
  alpha: number;

  @ApiProperty({ example: 30 })
  replicas: number;

  @ApiProperty({
    example: 7.4,
    description: 'Mean of baseline minus scenario vehicles (positive = fewer)',
  })
  meanDifference: number;

  @ApiProperty({ example: 2.1 })
  sdDifference: number;

  @ApiProperty({
    example: 6.45,
    description: 'Lower bound of the one-sided (1 - alpha) interval',
  })
  lowerBound: number;

  @ApiProperty({
    example: 19.3,
    nullable: true,
    description: 'Paired t; null when every difference is equal',
  })
  tStatistic: number | null;

  @ApiProperty({ description: 'HE0 is rejected: the scenario uses fewer cars' })
  rejectsNull: boolean;

  @ApiProperty({
    type: WilcoxonResource,
    nullable: true,
    description: 'Signed-rank check; null with fewer than 10 non-zero pairs',
  })
  wilcoxon: WilcoxonResource | null;
}

// Métricas de RF-18 agregadas entre réplicas
class LegStatsResource {
  @ApiProperty({
    type: MetricStatResource,
    description: 'Vehicles avoided on the way to campus, in %',
  })
  toCampusAvoidedPct: MetricStatResource;

  @ApiProperty({
    type: MetricStatResource,
    description: 'Vehicles avoided on the way back from campus, in %',
  })
  fromCampusAvoidedPct: MetricStatResource;
}

class TripStateStatsResource {
  @ApiProperty({
    type: MetricStatResource,
    description: 'Driver trips done with passengers, per replica',
  })
  finished: MetricStatResource;

  @ApiProperty({
    type: MetricStatResource,
    description: 'Driver trips that expired without passengers, per replica',
  })
  expired: MetricStatResource;

  @ApiProperty({
    type: MetricStatResource,
    description: 'Driver trips cancelled (S5), per replica',
  })
  cancelled: MetricStatResource;
}

class OtherModeStatsResource {
  @ApiProperty({
    type: MetricStatResource,
    description:
      'Trips (to and from campus) in which people who came by public transport or another mode got a seat, per replica',
  })
  coveredTrips: MetricStatResource;

  @ApiProperty({
    type: MetricStatResource,
    description: 'Share of their requested trips that got a seat, in %',
  })
  coveredPct: MetricStatResource;

  @ApiProperty({
    type: MetricStatResource,
    description:
      'Extra cars: those of people from another mode who drive because they got passengers, per replica',
  })
  addedVehicles: MetricStatResource;
}

class SimulationSummaryResource {
  @ApiProperty({
    type: ComparedStatResource,
    description: 'Vehicles of the whole day (to and from campus)',
  })
  vehiclesUsed: ComparedStatResource;

  @ApiProperty({
    type: ComparedStatResource,
    description: 'People per car (each person makes two trips a day)',
  })
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

  @ApiProperty({
    type: LegStatsResource,
    nullable: true,
    description:
      'Vehicles avoided on each leg; null in runs saved before the return trip was simulated',
  })
  legs: LegStatsResource | null;

  @ApiProperty({
    type: TripStateStatsResource,
    nullable: true,
    description:
      'How the driver trips end; null in runs saved before it was recorded',
  })
  tripStates: TripStateStatsResource | null;

  @ApiProperty({
    type: OtherModeStatsResource,
    nullable: true,
    description:
      'People who came by public transport or another mode and joined carpooling (nonCarAdoptionRate and nonCarDriverShare of the scenario); null in runs saved before it was measured',
  })
  otherMode: OtherModeStatsResource | null;

  @ApiProperty({
    type: PairedTestResource,
    nullable: true,
    description: 'Hypothesis test; null in runs saved before it existed',
  })
  vehiclesReduction: PairedTestResource | null;
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

// Los datos que no existían en las ejecuciones guardadas antes, a null
function withOptionalStats(
  summary: Partial<SimulationSummaryResource>,
): SimulationSummaryResource {
  return {
    ...(summary as SimulationSummaryResource),
    legs: summary.legs ?? null,
    tripStates: summary.tripStates ?? null,
    otherMode: summary.otherMode ?? null,
    vehiclesReduction: summary.vehiclesReduction ?? null,
  };
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
    summary: withOptionalStats(
      run.summary as Partial<SimulationSummaryResource>,
    ),
    series: run.series ?? [],
  };
}
