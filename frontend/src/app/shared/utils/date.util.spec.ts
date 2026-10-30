import { toIsoDate } from './date.util';

describe('toIsoDate', () => {
  it('writes the day and the month with two digits', () => {
    expect(toIsoDate(new Date(2026, 9, 7))).toBe('2026-10-07');
  });

  // Con la hora de España, a la una de la madrugada en UTC todavía es ayer
  it('keeps the local day after midnight', () => {
    expect(toIsoDate(new Date(2026, 10, 1, 1, 0))).toBe('2026-11-01');
  });
});
