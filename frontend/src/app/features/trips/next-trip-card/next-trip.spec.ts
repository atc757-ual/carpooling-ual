import { initAppTranslations } from '../../../core/i18n/testing-transloco';
import { DriverTrip } from '../../../core/models/driver.model';
import { passengerTrip } from '../passenger-trip-card/passenger-trip.testing';
import { isOpenRequest, NextTrip, nextTripLink, nextTripStatus, pickNextTrip } from './next-trip';

function driving(id: string, status: DriverTrip['status'], departureAt: string): NextTrip {
  return { role: 'driver', trip: { id, status, departureAt } as DriverTrip };
}

function riding(
  requestStatus: 'pending' | 'accepted',
  tripStatus: DriverTrip['status'] = 'confirmed',
): Extract<NextTrip, { role: 'passenger' }> {
  return { role: 'passenger', ...passengerTrip(requestStatus, tripStatus) };
}

describe('next trip', () => {
  beforeEach(() => initAppTranslations());

  it('keeps only pending or accepted seat requests', () => {
    expect(isOpenRequest(riding('pending').request)).toBe(true);
    expect(isOpenRequest(riding('accepted').request)).toBe(true);
    expect(isOpenRequest({ ...riding('accepted').request, status: 'rejected' })).toBe(false);
  });

  it('picks the running trip first, then the earliest one, and skips closed trips', () => {
    const early = driving('t1', 'published', '2099-01-15T06:00:00Z');
    const late = driving('t2', 'confirmed', '2099-01-16T06:00:00Z');
    const live = driving('t3', 'in_progress', '2099-01-17T06:00:00Z');
    const done = driving('t4', 'finished', '2099-01-14T06:00:00Z');

    expect(pickNextTrip([late, early, done])).toBe(early);
    expect(pickNextTrip([late, early, live])).toBe(live);
    expect(pickNextTrip([done])).toBeNull();
    expect(pickNextTrip([])).toBeNull();
  });

  it('links each role to its screen, and to the live trip when running', () => {
    expect(nextTripLink(driving('t1', 'confirmed', '2099-01-15T06:00:00Z'))).toBe(
      '/tabs/trips/published/t1',
    );
    expect(nextTripLink(driving('t1', 'in_progress', '2099-01-15T06:00:00Z'))).toBe(
      '/tabs/trips/drive/t1',
    );
    expect(nextTripLink(riding('accepted'))).toBe('/tabs/trips/requests/r1');
    expect(nextTripLink(riding('accepted', 'in_progress'))).toBe('/tabs/trips/ride/r1');
    expect(nextTripLink(riding('pending', 'in_progress'))).toBe('/tabs/trips/requests/r1');
  });

  it('labels the trip, or the seat while it is pending', () => {
    expect(nextTripStatus(riding('pending'))).toEqual({ label: 'Pendiente', kind: 'pending' });
    expect(nextTripStatus(riding('accepted'))).toEqual({ label: 'Confirmada', kind: 'accepted' });
    expect(nextTripStatus(driving('t1', 'confirmed', '2099-01-15T06:00:00Z'))).toEqual({
      label: 'Confirmado',
      kind: 'accepted',
    });
    expect(nextTripStatus(driving('t1', 'in_progress', '2099-01-15T06:00:00Z'))).toEqual({
      label: 'En curso',
      kind: 'accepted',
    });
    expect(nextTripStatus(driving('t1', 'published', '2099-01-15T06:00:00Z'))).toEqual({
      label: 'Publicado',
      kind: 'info',
    });
  });
});
