import { initAppTranslations } from '../../../core/i18n/testing-transloco';
import { ApiError } from '../../../core/models/api-error.model';
import {
  defaultRepeatUntil,
  latestRepeatDate,
  publishErrorMessage,
  rejectedRepeatDate,
  repeatDatesFor,
} from './repeat-days';

describe('repeat days', () => {
  beforeEach(() => initAppTranslations());

  it('gives the chosen weekdays after the first day, up to «until»', () => {
    // Lunes 23/11: lunes y miércoles hasta el 2/12
    expect(repeatDatesFor('2026-11-23', [1, 3], '2026-12-02')).toEqual([
      '2026-11-25',
      '2026-11-30',
      '2026-12-02',
    ]);
    expect(repeatDatesFor('2026-11-23', [], '2026-12-02')).toEqual([]);
  });

  it('never gives more than 30 days', () => {
    const everyDay = [1, 2, 3, 4, 5, 6, 7];
    expect(repeatDatesFor('2026-11-01', everyDay, '2026-12-31')).toHaveLength(30);
  });

  it('proposes 4 weeks, without going past a month from today', () => {
    expect(latestRepeatDate('2026-11-24')).toBe('2026-12-25');
    expect(defaultRepeatUntil('2026-11-25', '2026-11-24')).toBe('2026-12-22');
    expect(defaultRepeatUntil('2026-12-10', '2026-11-24')).toBe('2026-12-25');
  });

  it('says which day could not be published', () => {
    const rejected = new ApiError('REPEAT_DATE_REJECTED', 409, {
      message: 'Repeat date 2026-12-02 (TRIP_OVERLAPS): overlaps',
    });
    expect(rejectedRepeatDate(rejected)).toBe('2026-12-02');
    expect(publishErrorMessage(rejected)).toContain('2 dic');

    const other = new ApiError('TRIP_OVERLAPS', 409, { message: 'Repeat date 2026-12-02' });
    expect(rejectedRepeatDate(other)).toBeNull();
    expect(publishErrorMessage(other)).not.toContain('2 dic');
    expect(rejectedRepeatDate(new ApiError('REPEAT_DATE_REJECTED', 409))).toBeNull();
  });
});
