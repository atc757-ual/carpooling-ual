// Simulación de escenarios en el panel (API /api/admin/simulations, RF-15 a
// RF-20)

export interface ScenarioConfig {
  code: string;
  name: string;
  users: number;
  adoptionRate: number;
  modalSplit: Record<string, number>;
  timeWindowMin: number;
  parameters: Record<string, unknown>;
}

export interface SimulationScenario extends ScenarioConfig {
  '@type'?: 'SimulationScenario';
  id: string;
  // Réplicas por defecto
  replicas: number;
}

export type SimulationRunStatus = 'queued' | 'running' | 'finished' | 'failed' | 'cancelled';

export interface SimulationRun {
  '@type'?: 'SimulationRun';
  id: string;
  href: string;
  scenario: string;
  baselineScenario: string;
  scenarioConfig: { scenario: ScenarioConfig; baseline: ScenarioConfig };
  replicas: number;
  seed: number;
  status: SimulationRunStatus;
  progress: number;
  requestedBy: string | null;
  snapshotAt: string;
  requestedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  errorCode: string | null;
  criterionMet: boolean | null;
}

// Media, desviación típica e intervalo de confianza del 95 %
export interface MetricStat {
  mean: number;
  sd: number;
  ciLow: number;
  ciHigh: number;
}

export interface ComparedStat {
  scenario: MetricStat;
  baseline: MetricStat;
}

export interface SlotSeries {
  slot: string;
  vehicles: number;
  baselineVehicles: number;
}

export interface SimulationResults {
  '@type'?: 'SimulationResults';
  href: string;
  replicas: number;
  criterionMet: boolean;
  summary: {
    vehiclesUsed: ComparedStat;
    averageOccupancy: ComparedStat;
    vehiclesAvoidedPct: MetricStat;
    requestsCoveredPct: MetricStat;
    matchingP95Ms: MetricStat;
    recoveryPct: MetricStat | null;
  };
  series: SlotSeries[];
}

export interface StartSimulation {
  scenario: string;
  baselineScenario?: string;
  replicas?: number;
  seed: number;
}

// Análisis de sensibilidad (API /api/admin/simulation-sweeps, capítulo 11):
// el mismo escenario con varios valores de un supuesto
export type SweepParameter = 'ownCarShare' | 'adoptionRate';
export type SweepStatus = 'running' | 'finished' | 'stopped';

export interface SweepVariant {
  value: number;
  runId: string | null;
  runHref: string | null;
  status: SimulationRunStatus | null;
  progress: number;
  vehiclesAvoidedPct: number | null;
  vehiclesAvoidedCiLow: number | null;
  vehiclesAvoidedCiHigh: number | null;
  requestsCoveredPct: number | null;
  rejectsNull: boolean | null;
  criterionMet: boolean | null;
}

export interface SimulationSweep {
  '@type'?: 'SimulationSweep';
  id: string;
  href: string;
  scenario: string;
  baselineScenario: string;
  parameter: SweepParameter;
  replicas: number;
  seed: number;
  status: SweepStatus;
  variants: SweepVariant[];
  createdAt: string;
}

export interface StartSweep extends StartSimulation {
  parameter: SweepParameter;
  values: number[];
}
