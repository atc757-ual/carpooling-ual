import { Logger } from '@nestjs/common';
import type { ScenarioConfig } from '../scenario-config';
import type { SimulationOutput } from '../simulation-metrics';
import { FAKE_SLOTS, fakeReplica, slotsBetween } from './fake-replica';
import { FakeSimulationRunner } from './fake-simulation-runner';
import type { SimulationJob, SimulationRunListener } from './simulation-runner';

// Como los escenarios del seed (dev-seed.sql)
function scenario(
  code: string,
  overrides: Partial<ScenarioConfig> = {},
): ScenarioConfig {
  return {
    code,
    name: code,
    users: 200,
    adoptionRate: code === 's0' ? 0 : 0.3,
    modalSplit: { own_car: 0.3, public_transport: 0.5, other: 0.2 },
    timeWindowMin: 15,
    parameters: {},
    ...overrides,
  };
}

const SCENARIOS: Record<string, ScenarioConfig> = {
  s0: scenario('s0'),
  s1: scenario('s1'),
  s2: scenario('s2', { users: 1000 }),
  s4: scenario('s4', { parameters: { vehicleCapacities: [2, 3, 4, 6] } }),
  s5: scenario('s5', { parameters: { cancellationRate: 0.1 } }),
};

function job(code: string, replicas = 3): SimulationJob {
  return {
    runId: `run-${code}`,
    scenario: SCENARIOS[code],
    baseline: SCENARIOS.s0,
    replicas,
    seed: 42,
  };
}

// Funciones simuladas sueltas (no métodos) para comprobar las llamadas
type TestListener = Record<keyof SimulationRunListener, jest.Mock> & {
  finished: Promise<SimulationOutput>;
};

function listener(): TestListener {
  let resolveFinished: (output: SimulationOutput) => void = () => undefined;
  const finished = new Promise<SimulationOutput>((resolve) => {
    resolveFinished = resolve;
  });
  return {
    finished,
    onStarted: jest.fn().mockResolvedValue(undefined),
    onProgress: jest.fn().mockResolvedValue(undefined),
    onFinished: jest.fn((_runId: string, output: SimulationOutput) => {
      resolveFinished(output);
      return Promise.resolve();
    }),
    onFailed: jest.fn().mockResolvedValue(undefined),
  };
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('fake simulation runner', () => {
  it('gives the same replica for the same seed and another for the next', () => {
    expect(fakeReplica(job('s1'), 0)).toEqual(fakeReplica(job('s1'), 0));
    expect(fakeReplica(job('s1'), 1)).not.toEqual(fakeReplica(job('s1'), 0));
  });

  it('avoids no vehicles and covers no requests without carpooling (S0)', () => {
    const metrics = fakeReplica(job('s0'), 0);
    expect(metrics.vehiclesAvoidedPct).toBe(0);
    expect(metrics.requestsCoveredPct).toBe(0);
    expect(metrics.recoveryPct).toBeNull();
  });

  it('reports recovery only in the scenario with incidents (S5)', () => {
    expect(fakeReplica(job('s5'), 0).recoveryPct).not.toBeNull();
  });

  it('splits the morning into 30-minute slots', () => {
    expect(slotsBetween(420, 510)).toEqual(['07:00', '07:30', '08:00']);
    expect(FAKE_SLOTS).toHaveLength(6);
    expect(fakeReplica(job('s1'), 0).vehiclesBySlot).toHaveLength(6);
  });

  it('covers more with more demand and less with smaller cars', () => {
    const basic = fakeReplica(job('s1'), 0).requestsCoveredPct;
    expect(fakeReplica(job('s2'), 0).requestsCoveredPct).toBeGreaterThan(basic);
    expect(fakeReplica(job('s4'), 0).requestsCoveredPct).toBeLessThan(basic);
  });

  it('starts, reports each replica and finishes with all of them', async () => {
    const runner = new FakeSimulationRunner(0);
    const events = listener();
    runner.start(job('s1'), events);
    const output = await events.finished;
    expect(events.onStarted).toHaveBeenCalledWith('run-s1');
    expect(events.onProgress).toHaveBeenLastCalledWith('run-s1', 3);
    expect(output.replicas).toHaveLength(3);
    expect(output.slots).toEqual(FAKE_SLOTS);
  });

  it('stops without finishing or failing when cancelled', async () => {
    const runner = new FakeSimulationRunner(50);
    const events = listener();
    runner.start(job('s1', 10), events);
    await wait(10);
    runner.cancel('run-s1');
    await wait(100);
    expect(events.onFinished).not.toHaveBeenCalled();
    expect(events.onFailed).not.toHaveBeenCalled();
  });

  it('reports a failure when the listener breaks', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const runner = new FakeSimulationRunner(0);
    const events = listener();
    events.onStarted.mockRejectedValue(new Error('database down'));
    runner.start(job('s1'), events);
    await wait(20);
    expect(events.onFailed).toHaveBeenCalledWith('run-s1', 'RUNNER_ERROR');
  });

  it('aborts every run on shutdown', async () => {
    const runner = new FakeSimulationRunner(50);
    const events = listener();
    runner.start(job('s1', 10), events);
    runner.onModuleDestroy();
    await wait(100);
    expect(events.onFinished).not.toHaveBeenCalled();
  });
});
