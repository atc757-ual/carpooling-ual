import {
  aggregate,
  describeValues,
  isCriterionMet,
  toCsv,
} from './simulation-metrics';
import type { ReplicaMetrics } from './simulation-metrics';

function replica(overrides: Partial<ReplicaMetrics> = {}): ReplicaMetrics {
  return {
    replica: 1,
    seed: 7,
    vehiclesUsed: 85,
    baselineVehiclesUsed: 100,
    vehiclesAvoidedPct: 15,
    requestsCoveredPct: 70,
    averageOccupancy: 1.4,
    baselineAverageOccupancy: 1.2,
    matchingP95Ms: 250,
    recoveryPct: null,
    vehiclesBySlot: [40, 45],
    baselineVehiclesBySlot: [50, 50],
    ...overrides,
  };
}

describe('simulation metrics', () => {
  it('describes a sample with mean, SD and the 95 % CI (Student t)', () => {
    expect(describeValues([10, 12, 14])).toEqual({
      mean: 12,
      sd: 2,
      ciLow: 7.03,
      ciHigh: 16.97,
    });
  });

  it('gives no spread with a single replica', () => {
    expect(describeValues([5])).toEqual({
      mean: 5,
      sd: 0,
      ciLow: 5,
      ciHigh: 5,
    });
  });

  it('uses the normal distribution beyond 31 replicas', () => {
    const values = Array.from({ length: 40 }, (_, i) => (i % 2 === 0 ? 0 : 2));
    const stat = describeValues(values);
    expect(stat.ciHigh - stat.mean).toBeCloseTo(
      (1.96 * stat.sd) / Math.sqrt(40),
      1,
    );
  });

  it('meets the criterion only with both thresholds', () => {
    expect(aggregate({ slots: [], replicas: [replica()] }).criterionMet).toBe(
      true,
    );
    const fewAvoided = aggregate({
      slots: [],
      replicas: [replica({ vehiclesAvoidedPct: 14.9 })],
    });
    expect(isCriterionMet(fewAvoided.summary)).toBe(false);
    const fewCovered = aggregate({
      slots: [],
      replicas: [replica({ requestsCoveredPct: 69 })],
    });
    expect(fewCovered.criterionMet).toBe(false);
  });

  it('averages the series by slot and the recovery only when there is one', () => {
    const results = aggregate({
      slots: ['07:00', '07:30'],
      replicas: [
        replica({ recoveryPct: 80 }),
        replica({ vehiclesBySlot: [42, 47], recoveryPct: 90 }),
      ],
    });
    expect(results.series).toEqual([
      { slot: '07:00', vehicles: 41, baselineVehicles: 50 },
      { slot: '07:30', vehicles: 46, baselineVehicles: 50 },
    ]);
    expect(results.summary.recoveryPct?.mean).toBe(85);
    expect(
      aggregate({ slots: [], replicas: [replica()] }).summary.recoveryPct,
    ).toBeNull();
  });

  it('exports one CSV row per replica, with empty recovery when missing', () => {
    const csv = toCsv([replica(), replica({ replica: 2, recoveryPct: 75 })]);
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe(
      'replica,seed,vehiclesUsed,baselineVehiclesUsed,vehiclesAvoidedPct,requestsCoveredPct,averageOccupancy,baselineAverageOccupancy,matchingP95Ms,recoveryPct',
    );
    expect(lines[1]).toBe('1,7,85,100,15,70,1.4,1.2,250,');
    expect(lines[2].endsWith(',75')).toBe(true);
  });
});
