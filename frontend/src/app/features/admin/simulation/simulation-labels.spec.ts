import { chartDescription, chartLayout, niceMax } from './slot-chart/slot-chart';
import { comparisonLabel, isActive, resultKpis, runStatusLabel } from './simulation-labels';
import { RESULTS, RUN } from './simulation.testing';

describe('simulation labels', () => {
  it('builds the KPI cards with their goal and confidence interval', () => {
    const kpis = resultKpis(RESULTS, 'S0');

    expect(kpis.map(({ label, value }) => [label, value])).toEqual([
      ['Vehículos evitados', '16,4 %'],
      ['Solicitudes cubiertas', '74,5 %'],
      ['Ocupación media', '1,42'],
      ['Tiempo de matching (p95)', '171 ms'],
    ]);
    expect(kpis[0].hint).toBe('Objetivo ≥ 15 %');
    expect(kpis[0].interval).toBe('IC 95 %: 15,9–16,9 %');
    expect(kpis[2].hint).toBe('personas por coche (S0: 1,2)');
  });

  it('adds the recovery card only with incidents', () => {
    const withIncidents = {
      ...RESULTS,
      summary: { ...RESULTS.summary, recoveryPct: { mean: 80, sd: 2, ciLow: 79, ciHigh: 81 } },
    };
    expect(resultKpis(withIncidents, 'S0').at(-1)?.label).toBe('Recuperación tras incidencias');
  });

  it('adds the vehicles avoided on each leg and how the driver trips end', () => {
    const stat = (mean: number) => ({ mean, sd: 1, ciLow: mean - 1, ciHigh: mean + 1 });
    const kpis = resultKpis(
      {
        ...RESULTS,
        summary: {
          ...RESULTS.summary,
          legs: { toCampusAvoidedPct: stat(18), fromCampusAvoidedPct: stat(12.5) },
          tripStates: { finished: stat(40), expired: stat(22), cancelled: stat(0) },
        },
      },
      'S0',
    );

    expect(kpis.slice(4).map(({ label, value }) => [label, value])).toEqual([
      ['Evitados a la ida', '18 %'],
      ['Evitados a la vuelta', '12,5 %'],
      ['Viajes de los conductores', '40 hechos'],
    ]);
    expect(kpis[6].hint).toBe('22 caducados sin pasajeros · 0 cancelados');
  });

  it('labels only the slots on the hour', () => {
    const { groups } = chartLayout([
      { slot: '07:00', vehicles: 1, baselineVehicles: 2 },
      { slot: '07:30', vehicles: 1, baselineVehicles: 2 },
    ]);
    expect(groups.map(({ isHour }) => isHour)).toEqual([true, false]);
  });

  it('writes the run state and comparison', () => {
    expect(comparisonLabel(RUN)).toBe('S1 frente a S0');
    expect(runStatusLabel('running')).toBe('En curso');
    expect(isActive({ status: 'queued' })).toBe(true);
    expect(isActive({ status: 'cancelled' })).toBe(false);
  });
});

describe('slot chart', () => {
  it('rounds the axis maximum up', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(17)).toBe(20);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(130)).toBe(200);
  });

  it('places two bars per slot, the scenario after the baseline, scaled to the axis', () => {
    const { groups, ticks } = chartLayout(RESULTS.series);

    expect(groups.map(({ slot }) => slot)).toEqual(['07:00', '07:30']);
    const [first, second] = groups;
    expect(first.scenario.x).toBeGreaterThan(first.baseline.x);
    expect(second.baseline.height).toBeCloseTo(first.baseline.height * 2);
    expect(ticks.map(({ value }) => value)).toEqual([0, 10, 20]);
  });

  it('describes all the data for screen readers', () => {
    expect(chartDescription(RESULTS.series, { baseline: 'S0', scenario: 'S1' })).toBe(
      'Vehículos por franja horaria (llegadas al campus y salidas para volver). 07:00: S0 10, S1 8; 07:30: S0 20, S1 17.',
    );
  });
});
