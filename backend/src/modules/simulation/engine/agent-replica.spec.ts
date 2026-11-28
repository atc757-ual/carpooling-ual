import { liveTwin } from '../../digital-twin/model/live-twin.testing';
import { protectSnapshot } from '../../digital-twin/model/twin-snapshot-privacy';
import type { SimulationJob } from '../runner/simulation-runner';
import type { ScenarioConfig } from '../scenario-config';
import { agentReplica, simulateDay } from './agent-replica';
import { SLOT_COUNT } from './day-slots';
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
  it('without adoption, every car user drives as today, there and back', () => {
    const day = simulateDay(BASELINE, createRandom(1));

    expect(day.people).toBe(180);
    // 150 coches a la ida y 150 a la vuelta
    expect(day.vehicles).toBeCloseTo(300);
    expect(day.returnVehicles).toBeCloseTo(150);
    expect(day.passengers).toBe(0);
    expect(day.vehiclesBySlot).toHaveLength(SLOT_COUNT);
    expect(day.vehiclesBySlot.reduce((sum, v) => sum + v, 0)).toBeCloseTo(300);
    expect(day.trips).toEqual({ finished: 0, expired: 0, cancelled: 0 });
  });

  it('shares cars and covers part of the passengers', () => {
    const day = simulateDay(
      { ...BASELINE, adoptionRate: 0.5 },
      createRandom(1),
    );

    expect(day.coveredPassengers).toBeGreaterThan(0);
    expect(day.coveredPassengers).toBeLessThanOrEqual(day.passengers);
    expect(day.vehicles).toBeLessThan(300);
  });

  it('ends each driver trip as on the platform: done with passengers or expired', () => {
    const config = { ...BASELINE, users: 3000, adoptionRate: 0.5 };
    const day = simulateDay(config, createRandom(2));
    const drivers = day.trips.finished + day.trips.expired;

    expect(day.trips.finished).toBeGreaterThan(0);
    expect(day.trips.expired).toBeGreaterThan(0);
    expect(day.trips.cancelled).toBe(0);
    // Cada conductor publica un viaje a la ida y otro a la vuelta
    expect(drivers % 2).toBe(0);

    const s5 = simulateDay(
      { ...config, parameters: { cancellationRate: 0.5 } },
      createRandom(2),
    );
    expect(s5.trips.cancelled).toBeGreaterThan(0);
    expect(s5.trips.finished + s5.trips.expired + s5.trips.cancelled).toBe(
      drivers,
    );
  });

  it('takes the pickup mode and how far drivers go out of the way from the scenario', () => {
    const config = { ...BASELINE, users: 3000, adoptionRate: 0.5 };
    const covered = (parameters: Record<string, unknown>): number =>
      simulateDay({ ...config, parameters }, createRandom(3)).coveredPassengers;

    const byDefault = covered({});
    expect(covered({ maxDetourM: 150 })).toBeLessThan(byDefault);
    expect(covered({ maxDetourM: 500 })).toBeGreaterThan(byDefault);
    // Con paradas se camina hasta 800 m: cambia quién encaja a la ida
    expect(covered({ pickupMode: 'stops' })).not.toBe(byDefault);
  });
});

describe('agentReplica', () => {
  // Parte de la copia del gemelo vivo, pero sus viajes aún no se ofrecen ni
  // cuentan: con la misma semilla, las métricas son las de siempre
  it('starts from the copy of the live twin without changing the metrics', () => {
    const twinSnapshot = protectSnapshot(
      liveTwin().snapshot(new Date('2026-11-28T08:46:00Z')),
    );

    expect(withoutTiming(agentReplica({ ...job(), twinSnapshot }, 0))).toEqual(
      withoutTiming(agentReplica(job(), 0)),
    );
  });

  it('is reproducible with the same seed', () => {
    expect(withoutTiming(agentReplica(job(), 0))).toEqual(
      withoutTiming(agentReplica(job(), 0)),
    );
    expect(agentReplica(job(), 1).seed).toBe(12);
  });

  it('compares with the baseline of the same people', () => {
    const metrics = agentReplica(job(), 0);

    expect(metrics.baselineVehiclesUsed).toBe(300);
    expect(metrics.returnBaselineVehiclesUsed).toBe(150);
    expect(metrics.returnVehiclesUsed).toBeLessThanOrEqual(150);
    expect(metrics.baselineAverageOccupancy).toBe(1.2);
    expect(metrics.vehiclesAvoidedPct).toBeGreaterThan(0);
    expect(metrics.averageOccupancy).toBeGreaterThan(1.2);
    expect(metrics.recoveryPct).toBeNull();
    expect(metrics.vehiclesBySlot).toHaveLength(SLOT_COUNT);
    expect(metrics.trips?.finished).toBeGreaterThanOrEqual(0);
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

  it('gives the same as always, with nobody from other modes, without their assumption', () => {
    const metrics = agentReplica(job(), 0);

    expect(metrics.otherMode).toEqual({
      passengerTrips: 0,
      coveredTrips: 0,
      coveredPct: 0,
      addedVehicles: 0,
    });
  });

  // Quien iba en bus y consigue plaza no deja ningún coche; quien se queda
  // sin ella sigue en su modo (no suma coche). Solo los que conducen suman
  it('counts who comes by another mode as passengers, with no car of their own', () => {
    const passengersOnly = agentReplica(
      job({ parameters: { nonCarAdoptionRate: 0.3 } }),
      0,
    );
    const carOnly = agentReplica(job(), 0);

    expect(passengersOnly.otherMode?.passengerTrips).toBeGreaterThan(0);
    expect(passengersOnly.otherMode?.coveredTrips).toBeGreaterThan(0);
    expect(passengersOnly.otherMode?.addedVehicles).toBe(0);
    expect(passengersOnly.baselineVehiclesUsed).toBe(
      carOnly.baselineVehiclesUsed,
    );
    // Ocupan plazas de coches que van igualmente: sube la ocupación
    expect(passengersOnly.averageOccupancy).toBeGreaterThan(
      carOnly.averageOccupancy,
    );
  });

  it('adds the cars of who comes by another mode and drives with passengers', () => {
    const metrics = agentReplica(
      job({
        parameters: { nonCarAdoptionRate: 0.3, nonCarDriverShare: 1 },
      }),
      0,
    );

    // Todos conducen: nadie de otro modo pide plaza
    expect(metrics.otherMode?.passengerTrips).toBe(0);
    expect(metrics.otherMode?.addedVehicles).toBeGreaterThan(0);
  });
});
