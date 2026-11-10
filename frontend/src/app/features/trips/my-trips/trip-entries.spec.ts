import { DriverTrip } from '../../../core/models/driver.model';
import { passengerTrip } from '../passenger-trip-card/passenger-trip.testing';
import {
  driverEntry,
  entryTab,
  groupByDay,
  passengerEntry,
  TripEntry,
  tabEntries,
} from './trip-entries';

function driverTrip(id: string, status: DriverTrip['status'], departureAt: string): DriverTrip {
  return { id, status, departureAt } as DriverTrip;
}

function passenger(id: string, departureAt: string): TripEntry {
  const item = passengerTrip('pending', 'published');
  return passengerEntry({
    request: { ...item.request, id },
    trip: { ...item.trip, departureAt },
  });
}

const ids = (entries: readonly TripEntry[]): string[] => entries.map(({ id }) => id);

describe('trip entries', () => {
  it('puts each role in its tab', () => {
    expect(entryTab(driverEntry(driverTrip('t1', 'finished', '2099-01-15T08:00:00Z')))).toBe(
      'past',
    );
    expect(entryTab(passenger('r1', '2099-01-15T08:00:00Z'))).toBe('upcoming');
  });

  it('mixes both roles by departure, with the trips to answer first in each day', () => {
    const entries = [
      driverEntry(driverTrip('t1', 'published', '2099-01-15T09:00:00Z')),
      driverEntry(driverTrip('t2', 'published', '2099-01-15T11:00:00Z'), 2),
      passenger('r1', '2099-01-15T08:00:00Z'),
      passenger('r2', '2099-01-16T07:00:00Z'),
      driverEntry(driverTrip('t3', 'finished', '2099-01-10T09:00:00Z')),
      driverEntry(driverTrip('t4', 'finished', '2099-01-12T09:00:00Z')),
    ];

    expect(ids(tabEntries(entries, 'upcoming'))).toEqual([
      'driver-t2',
      'passenger-r1',
      'driver-t1',
      'passenger-r2',
    ]);
    expect(ids(tabEntries(entries, 'past'))).toEqual(['driver-t4', 'driver-t3']);
    expect(tabEntries(entries, 'cancelled')).toEqual([]);
  });

  it('groups them by day, keeping their order', () => {
    const groups = groupByDay([
      passenger('r1', '2099-01-15T08:00:00Z'),
      passenger('r2', '2099-01-15T09:00:00Z'),
      passenger('r3', '2099-01-16T09:00:00Z'),
    ]);

    expect(groups.map(({ entries }) => ids(entries))).toEqual([
      ['passenger-r1', 'passenger-r2'],
      ['passenger-r3'],
    ]);
    expect(new Set(groups.map(({ id }) => id)).size).toBe(2);
  });
});
