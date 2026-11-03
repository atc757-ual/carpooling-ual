import type { TwinEvent } from './twin-event';
import { VehicleTwin } from './vehicle-twin';

const VEHICLE_ID = 'vehicle-1';
const POINT = { type: 'Point', coordinates: [-2.4, 36.83] };

function tripEvent(
  tripId: string,
  status: string,
  vehicleId = VEHICLE_ID,
): TwinEvent {
  return {
    id: `${tripId}-${status}`,
    sequence: 1,
    type: 'trip.updated',
    version: 1,
    sourceEntityId: tripId,
    payload: { driverId: 'driver-1', vehicleId, status },
    occurredAt: new Date('2026-11-03T08:00:00Z'),
  };
}

function positionEvent(tripId: string): TwinEvent {
  return {
    ...tripEvent(tripId, 'in_progress'),
    type: 'trip.position_updated',
    payload: { position: POINT, recordedAt: '2026-11-03T08:40:00.000Z' },
  };
}

describe('VehicleTwin', () => {
  let vehicle: VehicleTwin;

  beforeEach(() => {
    vehicle = new VehicleTwin(VEHICLE_ID);
  });

  it('starts idle', () => {
    expect(vehicle.status).toBe('idle');
  });

  it.each([
    ['published', 'scheduled'],
    ['confirmed', 'scheduled'],
    ['in_progress', 'on_trip'],
    ['finished', 'idle'],
    ['cancelled', 'idle'],
  ])('a trip %s leaves it %s', (tripStatus, status) => {
    vehicle.apply(tripEvent('t-1', 'published'));
    expect(vehicle.apply(tripEvent('t-1', tripStatus))).toBe(true);

    expect(vehicle.status).toBe(status);
    expect(vehicle.driverId).toBe('driver-1');
  });

  it('stays scheduled while other trips are pending after one finishes', () => {
    vehicle.apply(tripEvent('t-1', 'in_progress'));
    vehicle.apply(tripEvent('t-2', 'published'));
    expect(vehicle.status).toBe('on_trip');

    vehicle.apply(tripEvent('t-1', 'finished'));
    expect(vehicle.status).toBe('scheduled');
    expect(vehicle.activeTripId).toBeNull();
  });

  it('follows the position of its trip in progress and forgets it after', () => {
    vehicle.apply(positionEvent('t-1'));
    expect(vehicle.position).toBeNull();

    vehicle.apply(tripEvent('t-1', 'in_progress'));
    vehicle.apply(positionEvent('t-1'));
    expect(vehicle.position).toEqual(POINT);
    expect(vehicle.positionAt).toEqual(new Date('2026-11-03T08:40:00.000Z'));

    vehicle.apply(tripEvent('t-1', 'finished'));
    expect(vehicle.position).toBeNull();
    expect(vehicle.positionAt).toBeNull();
  });

  it('releases a trip that moves to another vehicle', () => {
    vehicle.apply(tripEvent('t-1', 'in_progress'));
    vehicle.apply(tripEvent('t-2', 'published'));

    vehicle.apply(tripEvent('t-1', 'in_progress', 'vehicle-2'));
    vehicle.apply(tripEvent('t-2', 'published', 'vehicle-2'));

    expect(vehicle.status).toBe('idle');
    expect(vehicle.driverId).toBe('driver-1');
  });

  it('does not apply events about requests or users', () => {
    const request = { ...tripEvent('t-1', 'pending'), type: 'request.created' };

    expect(vehicle.apply(request)).toBe(false);
    expect(vehicle.updatedAt).toBeNull();
  });
});
