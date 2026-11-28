import { DigitalTwinSnapshotService } from './digital-twin-snapshot.service';
import { liveTwin } from './model/live-twin.testing';
import type { DigitalTwinSyncService } from './sync/digital-twin-sync.service';

describe('DigitalTwinSnapshotService', () => {
  it('copies the live twin already protected, with its summary', () => {
    const twin = liveTwin();
    const service = new DigitalTwinSnapshotService({
      twin,
    } as unknown as DigitalTwinSyncService);

    const { snapshot, summary } = service.copyLiveTwin(
      new Date('2026-11-28T08:46:00Z'),
    );

    expect(snapshot.lastSequence).toBe(twin.lastSequence);
    expect(snapshot.trips.map((trip) => trip.id)).toEqual([
      'viaje-1',
      'viaje-2',
    ]);
    expect(snapshot.trips[0].position).toBeNull();
    expect(summary).toMatchObject({
      takenAt: '2026-11-28T08:46:00.000Z',
      openTrips: 2,
      tripsInProgress: 1,
    });
    // El gemelo vivo sigue con sus identificadores
    expect(twin.trips.has('t-1')).toBe(true);
  });
});
