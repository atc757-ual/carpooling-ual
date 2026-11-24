import { BusinessError } from '../../shared/errors/business-error';
import { InvalidRepeatDatesError } from './errors/invalid-repeat-dates.error';
import { RepeatDateRejectedError } from './errors/repeat-date-rejected.error';
import {
  asRepeatDate,
  assertRepeatDates,
  localDateOf,
  sameTimeOn,
} from './trip-series';

class TestRuleError extends BusinessError {
  constructor() {
    super('DAILY_TRIP_LIMIT', 'conflict', 'At most 4 trips a day');
  }
}

describe('trip series', () => {
  // Lunes 23/11/2026, 08:00 en España (07:00 UTC, en horario de invierno)
  const monday = new Date('2026-11-23T07:00:00.000Z');
  const now = new Date('2026-11-22T10:00:00.000Z');

  it('repeats the same wall-clock time in Spain on another day', () => {
    expect(sameTimeOn(monday, '2026-11-25').toISOString()).toBe(
      '2026-11-25T07:00:00.000Z',
    );
  });

  it('keeps the wall-clock time across a change of time', () => {
    // Viernes 27/03/2026, 08:00 (invierno, UTC+1) → lunes 30/03 (verano, UTC+2)
    const friday = new Date('2026-03-27T07:00:00.000Z');
    expect(sameTimeOn(friday, '2026-03-30').toISOString()).toBe(
      '2026-03-30T06:00:00.000Z',
    );
    // Y al revés, el 25/10/2026 vuelve el horario de invierno
    const summer = new Date('2026-10-23T06:00:00.000Z');
    expect(sameTimeOn(summer, '2026-10-26').toISOString()).toBe(
      '2026-10-26T07:00:00.000Z',
    );
  });

  it('gives the day in Spain, not in UTC', () => {
    // 23:30 UTC del 23 ya es día 24 en España
    expect(localDateOf(new Date('2026-11-23T23:30:00.000Z'))).toBe(
      '2026-11-24',
    );
  });

  it('accepts real days after the first one and up to a month from today', () => {
    expect(() =>
      assertRepeatDates(monday, ['2026-11-25', '2026-12-23'], now),
    ).not.toThrow();
  });

  it.each([
    ['the first day itself', '2026-11-23'],
    ['a day before the first one', '2026-11-20'],
    ['a day more than a month from today', '2026-12-24'],
    ['a day that does not exist', '2026-11-31'],
  ])('refuses %s', (_case, date) => {
    expect(() => assertRepeatDates(monday, [date], now)).toThrow(
      InvalidRepeatDatesError,
    );
  });

  it('refuses repeated days or more than 30', () => {
    expect(() =>
      assertRepeatDates(monday, ['2026-11-25', '2026-11-25'], now),
    ).toThrow(InvalidRepeatDatesError);
    const tooMany = Array.from(
      { length: 31 },
      (_day, index) => `2026-12-${String(index + 1).padStart(2, '0')}`,
    );
    const firstOfMonth = new Date('2026-11-30T07:00:00.000Z');
    expect(() =>
      assertRepeatDates(
        firstOfMonth,
        tooMany,
        new Date('2026-12-01T08:00:00Z'),
      ),
    ).toThrow(InvalidRepeatDatesError);
  });

  it('says which day broke a rule, with its code and status', async () => {
    const failure = asRepeatDate('2026-11-25', () =>
      Promise.reject(new TestRuleError()),
    );
    await expect(failure).rejects.toBeInstanceOf(RepeatDateRejectedError);
    await expect(failure).rejects.toMatchObject({
      code: 'REPEAT_DATE_REJECTED',
      kind: 'conflict',
      message:
        'Repeat date 2026-11-25 (DAILY_TRIP_LIMIT): At most 4 trips a day',
    });

    const unexpected = new Error('down');
    await expect(
      asRepeatDate('2026-11-25', () => Promise.reject(unexpected)),
    ).rejects.toBe(unexpected);
    await expect(
      asRepeatDate('2026-11-25', () => Promise.resolve(1)),
    ).resolves.toBe(1);
  });
});
