import {
  MetricStat,
  SimulationResults,
  SimulationRun,
  SimulationScenario,
} from '../../../core/models/admin-simulation.model';

// Datos de ejemplo para los tests de la simulación del panel

function stat(mean: number): MetricStat {
  return { mean, sd: 1, ciLow: mean - 0.5, ciHigh: mean + 0.5 };
}

export const SCENARIO_CONFIG = {
  code: 'S1',
  name: 'Carpooling básico',
  users: 200,
  adoptionRate: 0.3,
  modalSplit: { own_car: 0.3 },
  timeWindowMin: 15,
  parameters: {},
};

export const SCENARIOS: SimulationScenario[] = [
  { ...SCENARIO_CONFIG, id: 's0', code: 'S0', name: 'Base', adoptionRate: 0, replicas: 30 },
  { ...SCENARIO_CONFIG, id: 's1', replicas: 30 },
];

export const RUN: SimulationRun = {
  id: 'r1',
  href: '/api/admin/simulations/r1',
  scenario: 'S1',
  baselineScenario: 'S0',
  scenarioConfig: { scenario: SCENARIO_CONFIG, baseline: { ...SCENARIO_CONFIG, code: 'S0' } },
  replicas: 30,
  seed: 7,
  status: 'finished',
  progress: 30,
  requestedBy: 'admin-1',
  snapshotAt: '2026-10-25T08:12:00.000Z',
  requestedAt: '2026-10-25T08:12:00.000Z',
  startedAt: '2026-10-25T08:12:01.000Z',
  finishedAt: '2026-10-25T08:12:31.000Z',
  errorCode: null,
  criterionMet: true,
};

export const RESULTS: SimulationResults = {
  href: '/api/admin/simulations/r1/results',
  replicas: 30,
  criterionMet: true,
  summary: {
    vehiclesUsed: { scenario: stat(42), baseline: stat(50) },
    averageOccupancy: { scenario: stat(1.42), baseline: stat(1.2) },
    vehiclesAvoidedPct: stat(16.4),
    requestsCoveredPct: stat(74.5),
    matchingP95Ms: stat(171),
    recoveryPct: null,
  },
  series: [
    { slot: '07:00', vehicles: 8, baselineVehicles: 10 },
    { slot: '07:30', vehicles: 17, baselineVehicles: 20 },
  ],
};
