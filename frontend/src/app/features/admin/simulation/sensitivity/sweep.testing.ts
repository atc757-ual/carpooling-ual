import { SimulationSweep, SweepVariant } from '../../../../core/models/admin-simulation.model';

// Datos de ejemplo para los tests del análisis de sensibilidad

export function variant(value: number, overrides: Partial<SweepVariant> = {}): SweepVariant {
  return {
    value,
    runId: `run-${value}`,
    runHref: `/api/admin/simulations/run-${value}`,
    status: 'finished',
    progress: 30,
    vehiclesAvoidedPct: value * 40,
    vehiclesAvoidedCiLow: value * 40 - 1,
    vehiclesAvoidedCiHigh: value * 40 + 1,
    requestsCoveredPct: 60,
    rejectsNull: true,
    criterionMet: value * 40 >= 15,
    ...overrides,
  };
}

export const PENDING: Partial<SweepVariant> = {
  runId: null,
  runHref: null,
  status: null,
  progress: 0,
  vehiclesAvoidedPct: null,
  vehiclesAvoidedCiLow: null,
  vehiclesAvoidedCiHigh: null,
  requestsCoveredPct: null,
  rejectsNull: null,
  criterionMet: null,
};

export const SWEEP: SimulationSweep = {
  id: 'sweep-1',
  href: '/api/admin/simulation-sweeps/sweep-1',
  scenario: 'S1',
  baselineScenario: 'S0',
  parameter: 'ownCarShare',
  replicas: 30,
  seed: 7,
  status: 'finished',
  variants: [variant(0.2), variant(0.3), variant(0.5)],
  createdAt: '2026-11-09T22:00:00.000Z',
};

export const RUNNING_SWEEP: SimulationSweep = {
  ...SWEEP,
  status: 'running',
  variants: [
    variant(0.2),
    variant(0.3, { ...PENDING, runId: 'run-0.3', status: 'running', progress: 12 }),
    variant(0.5, PENDING),
  ],
};
