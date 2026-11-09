import type { SimulationJob } from '../runner/simulation-runner';
import type { ScenarioConfig } from '../scenario-config';
import { agentReplica, simulateDay } from './agent-replica';
import { createRandom } from './population';

const BASELINE: ScenarioConfig = {
  code: 'S0',
  name: 'Base',
  users: 600,
  adoptionRate: 0,
  modalSplit: { own_car: 0.3, public_transport: 0.5, other: 0.2 },
  timeWindowMin: 15,
  parameters: {},
};

function job(scenario: Partial<ScenarioConfig> = {}): SimulationJob {
  return {
    runId: 'run-1',
    replicas: 3,
    seed: 11,
    baseline: BASELINE,
    scenario: { ...BASELINE, code: 'S1', adoptionRate: 0.5, ...scenario },
  };
}

// Todo salvo el tiempo medido del matching, que depende de la máquina
function withoutTiming(
  metrics: ReturnType<typeof agentReplica>,
): Omit<ReturnType<typeof agentReplica>, 'matchingP95Ms'> {
  const { matchingP95Ms, ...rest } = metrics;
  expect(matchingP95Ms).toBeGreaterThanOrEqual(0);
  return rest;
}

describe('simulateDay', () => {
  it('without adoption, every car user drives as today', () => {
    const day = simulateDay(BASELINE, createRandom(1));

    expect(day.people).toBe(180);
    expect(day.vehicles).toBeCloseTo(150);
    expect(day.passengers).toBe(0);
    expect(day.vehiclesBySlot.reduce((sum, v) => sum + v, 0)).toBeCloseTo(150);
  });

  it('shares cars and covers part of the passengers', () => {
    const day = simulateDay(
      { ...BASELINE, adoptionRate: 0.5 },
      createRandom(1),
    );

    expect(day.coveredPassengers).toBeGreaterThan(0);
    expect(day.coveredPassengers).toBeLessThanOrEqual(day.passengers);
    expect(day.vehicles).toBeLessThan(150);
  });
});

describe('agentReplica', () => {
  it('is reproducible with the same seed', () => {
    expect(withoutTiming(agentReplica(job(), 0))).toEqual(
      withoutTiming(agentReplica(job(), 0)),
    );
    expect(agentReplica(job(), 1).seed).toBe(12);
  });

  it('compares with the baseline of the same people', () => {
    const metrics = agentReplica(job(), 0);

    expect(metrics.baselineVehiclesUsed).toBe(150);
    expect(metrics.baselineAverageOccupancy).toBe(1.2);
    expect(metrics.vehiclesAvoidedPct).toBeGreaterThan(0);
    expect(metrics.averageOccupancy).toBeGreaterThan(1.2);
    expect(metrics.recoveryPct).toBeNull();
    expect(metrics.vehiclesBySlot).toHaveLength(6);
  });

  // Semillas emparejadas entre escenarios (sección 11 de la memoria): con la
  // misma semilla, la base de cualquier escenario es la ejecución de S0
  it('pairs every scenario with the S0 run of the same seed', () => {
    const s0 = agentReplica({ ...job(), scenario: BASELINE }, 4);
    const s1 = agentReplica(job(), 4);
    const s3 = agentReplica(
      job({ code: 'S3', parameters: { timeWindowRangeMin: [5, 60] } }),
      4,
    );

    expect(s1.seed).toBe(s0.seed);
    expect(s1.baselineVehiclesUsed).toBe(s0.vehiclesUsed);
    expect(s3.baselineVehiclesUsed).toBe(s0.vehiclesUsed);
    expect(s1.baselineVehiclesBySlot).toEqual(s0.vehiclesBySlot);
  });

  it('measures the recovery when drivers cancel (S5)', () => {
    const metrics = agentReplica(
      job({ parameters: { cancellationRate: 0.5 } }),
      0,
    );

    expect(metrics.recoveryPct).toBeGreaterThanOrEqual(0);
    expect(metrics.recoveryPct).toBeLessThanOrEqual(100);
  });

  it('counts a full recovery when nobody is affected', () => {
    const metrics = agentReplica(
      job({ adoptionRate: 0, parameters: { cancellationRate: 0.1 } }),
      0,
    );

    expect(metrics).toMatchObject({
      recoveryPct: 100,
      requestsCoveredPct: 0,
      vehiclesAvoidedPct: 0,
    });
  });

  it('has nothing to compare without car users', () => {
    const empty = { modalSplit: { public_transport: 1 } };
    const metrics = agentReplica(
      { ...job(empty), baseline: { ...BASELINE, ...empty } },
      0,
    );

    expect(metrics).toMatchObject({
      vehiclesUsed: 0,
      vehiclesAvoidedPct: 0,
      averageOccupancy: 0,
      baselineAverageOccupancy: 0,
      matchingP95Ms: 0,
    });
  });
});
