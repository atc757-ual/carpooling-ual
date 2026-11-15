import {
  DRIVER_LATE_CANCELLATION_LEAD_MIN,
  freeCancellationUntil,
  isWithinLeadMinutes,
  PASSENGER_LATE_CANCELLATION_LEAD_MIN,
} from './late-cancellation';

describe('late cancellation', () => {
  const departureAt = '2099-01-15T08:00:00.000Z';
  const minutesBefore = (minutes: number) => new Date(departureAt).getTime() - minutes * 60 * 1000;

  it('gives the driver 20 minutes and the passenger 10', () => {
    expect(DRIVER_LATE_CANCELLATION_LEAD_MIN).toBe(20);
    expect(PASSENGER_LATE_CANCELLATION_LEAD_MIN).toBe(10);
  });

  it('is late only under the lead minutes', () => {
    expect(isWithinLeadMinutes(departureAt, 10, minutesBefore(9))).toBe(true);
    expect(isWithinLeadMinutes(departureAt, 10, minutesBefore(10))).toBe(false);
  });

  it('tells until when cancelling is free', () => {
    expect(freeCancellationUntil(departureAt, 20)).toBe('2099-01-15T07:40:00.000Z');
  });
});
