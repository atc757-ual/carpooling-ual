import { addDays, weekdayOf } from './weekdays.util';

describe('weekdays util', () => {
  it('counts days on the calendar, also across months and changes of time', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-12-02', -7)).toBe('2026-11-25');
  });

  it('gives the weekday from Monday (1) to Sunday (7)', () => {
    expect(weekdayOf('2026-11-23')).toBe(1);
    expect(weekdayOf('2026-11-29')).toBe(7);
  });
});
