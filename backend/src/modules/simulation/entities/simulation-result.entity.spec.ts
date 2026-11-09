import { agentReplica } from '../engine/agent-replica';
import type { ScenarioConfig } from '../scenario-config';
import type { ReplicaMetrics } from '../simulation-metrics';
import { toReplicaMetrics, toResultRow } from './simulation-result.entity';
import type { SimulationResult } from './simulation-result.entity';

const BASE: ScenarioConfig = {
  code: 'S0',
  name: 'Base',
  users: 200,
  adoptionRate: 0,
  modalSplit: { own_car: 0.3, public_transport: 0.5, other: 0.2 },
  timeWindowMin: 15,
  parameters: {},
};

const METRICS: ReplicaMetrics = {
  replica: 1,
  seed: 7,
  vehiclesUsed: 85,
  baselineVehiclesUsed: 100,
  vehiclesAvoidedPct: 15,
  requestsCoveredPct: 70,
  averageOccupancy: 1.4,
  baselineAverageOccupancy: 1.2,
  matchingP95Ms: 0.65,
  recoveryPct: null,
  vehiclesBySlot: [40, 45],
  baselineVehiclesBySlot: [50, 50],
};

describe('simulation result rows', () => {
  // Causa de las ejecuciones que no terminaban (08/11): la columna
  // matching_p95_ms es entera y el motor de agentes da decimales
  it('stores the matching p95 as whole milliseconds', () => {
    expect(toResultRow('run-1', 'scenario-1', METRICS).matchingP95Ms).toBe(1);
    expect(
      toResultRow('run-1', 'scenario-1', { ...METRICS, matchingP95Ms: 0.4 })
        .matchingP95Ms,
    ).toBe(0);
  });

  it('only gives integers to the integer columns, with the real engine', () => {
    const metrics = agentReplica(
      {
        runId: 'run-1',
        replicas: 1,
        seed: 3,
        baseline: BASE,
        scenario: { ...BASE, code: 'S1', adoptionRate: 0.3 },
      },
      0,
    );
    const row = toResultRow('run-1', 'scenario-1', metrics);

    for (const value of [
      row.replica,
      row.seed,
      row.vehicleCount,
      row.baselineVehicleCount,
      row.matchingP95Ms,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('reads back the metrics it stored', () => {
    const row = toResultRow('run-1', 'scenario-1', METRICS) as SimulationResult;

    expect(toReplicaMetrics(row)).toEqual({ ...METRICS, matchingP95Ms: 1 });
  });
});
