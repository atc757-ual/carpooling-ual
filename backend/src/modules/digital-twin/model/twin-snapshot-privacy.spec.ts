import { event, liveTwin, trip } from './live-twin.testing';
import { protectSnapshot, summarizeSnapshot } from './twin-snapshot-privacy';

const takenAt = new Date('2026-11-28T08:46:00.000Z');

// El gemelo de prueba más un viaje ya cancelado, que no debe copiarse
function snapshotWithClosedTrip() {
  const twin = liveTwin();
  twin.apply(event('trip.cancelled', 't-3', trip('cancelled')));
  return twin.snapshot(takenAt);
}

describe('protectSnapshot', () => {
  it('keeps only the open trips, their vehicles and the active users', () => {
    const snapshot = snapshotWithClosedTrip();

    const isProtected = protectSnapshot(snapshot);

    expect(snapshot.trips).toHaveLength(3);
    expect(isProtected.trips.map((copied) => copied.status)).toEqual([
      'in_progress',
      'published',
    ]);
    expect(isProtected.vehicles).toHaveLength(1);
    expect(isProtected.users).toHaveLength(2);
    expect(isProtected.lastSequence).toBe(snapshot.lastSequence);
    expect(isProtected.takenAt).toBe(snapshot.takenAt);
  });

  it('swaps every id for an alias that still links the copy together', () => {
    const isProtected = protectSnapshot(snapshotWithClosedTrip());

    const [inProgress, published] = isProtected.trips;
    const [vehicle] = isProtected.vehicles;
    expect(inProgress.id).toBe('viaje-1');
    expect(published.id).toBe('viaje-2');
    expect(inProgress.driverId).toBe('usuario-1');
    expect(inProgress.vehicleId).toBe('vehiculo-1');
    expect(inProgress.requests[0].id).toBe('solicitud-1');
    expect(inProgress.requests[0].passengerId).toBe('usuario-2');
    expect(vehicle.id).toBe('vehiculo-1');
    expect(vehicle.driverId).toBe('usuario-1');
    expect(vehicle.activeTripId).toBe('viaje-1');
    expect(vehicle.scheduledTripIds).not.toContain('t-3');
    expect(isProtected.users.map((user) => user.id).sort()).toEqual([
      'usuario-1',
      'usuario-2',
    ]);
    expect(JSON.stringify(isProtected)).not.toMatch(/"(t|v|d|p|r|s)-\d"/);
  });

  it('drops positions, the track and stop names, and rounds the points', () => {
    const snapshot = snapshotWithClosedTrip();
    snapshot.trips[0].route.origin = {
      type: 'Point',
      coordinates: [-2.6012, 36.8023],
    };
    snapshot.trips[0].requests[0].pickupPoint = {
      type: 'Point',
      coordinates: [-2.5531, 36.8061],
    };

    const [inProgress] = protectSnapshot(snapshot).trips;

    expect(inProgress.position).toBeNull();
    expect(inProgress.positionAt).toBeNull();
    expect(inProgress.route.track).toEqual([]);
    expect(inProgress.route.trackPoints).toBe(0);
    expect(inProgress.route.travelledKm).toBe(0);
    expect(inProgress.route.stops[0].name).toBeNull();
    expect(inProgress.route.stops[0].id).toBe('parada-1');
    // A la cuadrícula común de 0,005°
    expect(inProgress.route.origin?.coordinates).toEqual([-2.6, 36.8]);
    expect(inProgress.requests[0].pickupPoint?.coordinates).toEqual([
      -2.555, 36.805,
    ]);
  });

  it('leaves the live snapshot untouched', () => {
    const snapshot = snapshotWithClosedTrip();
    const before = JSON.stringify(snapshot);

    protectSnapshot(snapshot);

    expect(JSON.stringify(snapshot)).toBe(before);
  });
});

describe('summarizeSnapshot', () => {
  it('counts what the copy started from, without personal data', () => {
    const summary = summarizeSnapshot(
      protectSnapshot(snapshotWithClosedTrip()),
    );

    expect(summary).toEqual({
      takenAt: '2026-11-28T08:46:00.000Z',
      openTrips: 2,
      tripsInProgress: 1,
      vehicles: 1,
      activeUsers: 2,
      drivers: 1,
      offeredSeats: 6,
      availableSeats: 4,
    });
  });
});
