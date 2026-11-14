import { toIsoDateTime } from '../publish-trip/publish-trip.utils';
import { defaultReturnTime, isReturnBeforeArrival, toReturnTripRequest } from './return-trip';

describe('return trip helpers', () => {
  it('proposes leaving six hours after arriving, the same day', () => {
    expect(defaultReturnTime('08:00')).toBe('14:00');
    expect(defaultReturnTime('20:15')).toBe('23:30');
  });

  it('asks the return trip to leave after arriving at the campus', () => {
    expect(isReturnBeforeArrival('08:00', '07:30')).toBe(true);
    expect(isReturnBeforeArrival('08:00', '08:00')).toBe(true);
    expect(isReturnBeforeArrival('08:00', '14:00')).toBe(false);
    expect(isReturnBeforeArrival('08:00', '')).toBe(false);
  });

  it('sends the return trip on the same date with its seats', () => {
    expect(toReturnTripRequest('2099-01-15', '14:30', 2)).toEqual({
      departureAt: toIsoDateTime('2099-01-15', '14:30'),
      offeredSeats: 2,
    });
  });
});
