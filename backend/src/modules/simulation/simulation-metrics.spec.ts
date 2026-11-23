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
    returnVehiclesUsed: 40,
    returnBaselineVehiclesUsed: 50,
    requestsCoveredPct: 70,
    averageOccupancy: 1.4,
    baselineAverageOccupancy: 1.2,
    matchingP95Ms: 250,
    recoveryPct: null,
    trips: { finished: 10, expired: 4, cancelled: 0 },
    vehiclesBySlot: [40, 45],
    baselineVehiclesBySlot: [50, 50],
    otherMode: {
      passengerTrips: 20,
      coveredTrips: 12,
      coveredPct: 60,
      addedVehicles: 2,
    },
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

  // Tres réplicas con 15, 14 y 16 vehículos menos que la base
  const passing = (overrides: Partial<ReplicaMetrics> = {}) => [
    replica(overrides),
    replica({ ...overrides, vehiclesUsed: 86 }),
    replica({ ...overrides, vehiclesUsed: 84 }),
  ];

  it('meets the criterion with both thresholds and HE0 rejected', () => {
    expect(aggregate({ slots: [], replicas: passing() }).criterionMet).toBe(
      true,
    );
    const fewAvoided = aggregate({
      slots: [],
      replicas: passing({ vehiclesAvoidedPct: 14.9 }),
    });
    expect(isCriterionMet(fewAvoided.summary)).toBe(false);
    const fewCovered = aggregate({
      slots: [],
      replicas: passing({ requestsCoveredPct: 69 }),
    });
    expect(fewCovered.criterionMet).toBe(false);
  });

  it('does not meet the criterion without the hypothesis test', () => {
    // Una sola réplica: los umbrales se cumplen, pero no hay contraste
    const single = aggregate({ slots: [], replicas: [replica()] });

    expect(single.summary.vehiclesReduction.rejectsNull).toBe(false);
    expect(single.criterionMet).toBe(false);
  });

  it('tests the vehicle reduction on the paired replicas', () => {
    const { vehiclesReduction } = aggregate({
      slots: [],
      replicas: passing(),
    }).summary;

    expect(vehiclesReduction).toMatchObject({
      alpha: 0.01,
      replicas: 3,
      meanDifference: 15,
      rejectsNull: true,
      wilcoxon: null,
    });
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

  it('exports one CSV row per replica, with empty values when missing', () => {
    const csv = toCsv([
      replica(),
      replica({
        replica: 2,
        recoveryPct: 75,
        returnVehiclesUsed: null,
        returnBaselineVehiclesUsed: null,
        trips: null,
        otherMode: null,
      }),
    ]);
    const lines = csv.trimEnd().split('\n');
    expect(lines[0]).toBe(
      'replica,seed,vehiclesUsed,baselineVehiclesUsed,vehiclesAvoidedPct,returnVehiclesUsed,returnBaselineVehiclesUsed,requestsCoveredPct,averageOccupancy,baselineAverageOccupancy,matchingP95Ms,recoveryPct,trips_finished,trips_expired,trips_cancelled,otherMode_passengerTrips,otherMode_coveredTrips,otherMode_coveredPct,otherMode_addedVehicles',
    );
    expect(lines[1]).toBe(
      '1,7,85,100,15,40,50,70,1.4,1.2,250,,10,4,0,20,12,60,2',
    );
    expect(lines[2]).toBe('2,7,85,100,15,,,70,1.4,1.2,250,75,,,,,,,');
  });

  it('gives the vehicles avoided on each leg, how the trips end and the other modes', () => {
    const { summary } = aggregate({
      slots: ['08:00', '08:30'],
      replicas: [
        replica(),
        replica({ vehiclesUsed: 90, returnVehiclesUsed: 45 }),
      ],
    });
    // Ida: 50 de base y 45 con carpooling en las dos (10 %); vuelta: 50 de
    // base y 40 o 45 (20 % y 10 %, media 15 %)
    expect(summary.legs?.toCampusAvoidedPct.mean).toBe(10);
    expect(summary.legs?.fromCampusAvoidedPct.mean).toBe(15);
    expect(summary.tripStates).toMatchObject({
      finished: { mean: 10 },
      expired: { mean: 4 },
      cancelled: { mean: 0 },
    });
    // Quienes iban en otro modo: la media de las réplicas
    expect(summary.otherMode).toMatchObject({
      coveredTrips: { mean: 12 },
      coveredPct: { mean: 60 },
      addedVehicles: { mean: 2 },
    });
  });

  it('leaves the legs, the trip states and the other modes out of runs saved before them', () => {
    const { summary } = aggregate({
      slots: ['08:00', '08:30'],
      replicas: [
        replica(),
        replica({
          returnVehiclesUsed: null,
          returnBaselineVehiclesUsed: null,
          trips: null,
          otherMode: null,
        }),
      ],
    });
    expect(summary.legs).toBeNull();
    expect(summary.tripStates).toBeNull();
    expect(summary.otherMode).toBeNull();
  });
});
