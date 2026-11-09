import { parseValues, sweepProgress, sweepProgressLabel, sweepRow } from './sweep-labels';
import { PENDING, RUNNING_SWEEP, SWEEP, variant } from './sweep.testing';

describe('sweep labels', () => {
  it('reads the values as percentages, with commas, semicolons or spaces', () => {
    expect(parseValues('20, 30, 50')).toEqual([0.2, 0.3, 0.5]);
    expect(parseValues('10;30 50')).toEqual([0.1, 0.3, 0.5]);
  });

  it('rejects too few or too many values, repeated ones and out of range', () => {
    expect(parseValues('30')).toBeNull();
    expect(parseValues('10, 20, 30, 40, 50, 60')).toBeNull();
    expect(parseValues('30, 30')).toBeNull();
    expect(parseValues('3, 30')).toBeNull();
    expect(parseValues('30, 120')).toBeNull();
    expect(parseValues('30, 2.5')).toBeNull();
    expect(parseValues('treinta, 50')).toBeNull();
  });

  it('says which variant is running and how far it is', () => {
    expect(sweepProgressLabel(RUNNING_SWEEP)).toBe('Variante 2 de 3 · 12/30 réplicas');
    expect(sweepProgressLabel(SWEEP)).toBe('Terminado');
    expect(sweepProgressLabel({ ...SWEEP, status: 'stopped' })).toContain('Parado');
  });

  it('counts the replicas of every variant for the progress bar', () => {
    expect(sweepProgress(RUNNING_SWEEP)).toBeCloseTo(42 / 90);
    expect(sweepProgress({ ...SWEEP, variants: [] })).toBe(0);
  });

  it('gives a table row per variant', () => {
    expect(sweepRow(variant(0.5))).toEqual({
      value: '50 %',
      avoided: '20 % (IC 19–21)',
      covered: '60 %',
      test: 'Se rechaza',
      criterion: 'Cumplido',
    });
    expect(sweepRow(variant(0.2, { rejectsNull: false })).test).toBe('No se rechaza');
    expect(sweepRow(variant(0.2)).criterion).toBe('No cumplido');
  });

  it('marks the variants without results as pending or running', () => {
    expect(sweepRow(variant(0.5, PENDING)).avoided).toBe('Pendiente');
    expect(sweepRow(variant(0.3, { ...PENDING, status: 'running' })).avoided).toBe('En curso');
  });
});
