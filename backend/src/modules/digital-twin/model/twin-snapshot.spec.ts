import { SystemTwin } from './system-twin';
import { event, liveTwin, trip } from './live-twin.testing';
import type { TwinEvent } from './twin-event';
import type { SystemTwinSnapshot } from './twin-snapshot';

describe('SystemTwin snapshot', () => {
  const takenAt = new Date('2026-11-28T08:46:00.000Z');

  it('copies the whole state into plain data that survives JSON', () => {
    const live = liveTwin();

    const snapshot = live.snapshot(takenAt);
    const stored = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;

    expect(stored).toEqual(snapshot);
    expect(snapshot.takenAt).toBe('2026-11-28T08:46:00.000Z');
    expect(snapshot.lastSequence).toBe(live.lastSequence);
    expect(snapshot.trips.map((trip) => trip.id)).toEqual(['t-1', 't-2']);
    expect(snapshot.vehicles.map((vehicle) => vehicle.id)).toEqual(['v-1']);
    expect(snapshot.users.map((user) => user.id)).toEqual(['d-1', 'p-1']);
  });

  it('rebuilds a twin that looks the same as the live one', () => {
    const live = liveTwin();

    const stored = JSON.stringify(live.snapshot(takenAt));
    const copy = SystemTwin.fromSnapshot(
      JSON.parse(stored) as SystemTwinSnapshot,
    );

    // Lo mismo salvo los contadores de eventos, que son de cada instancia
    expect(copy.summary()).toEqual({
      ...live.summary(),
      appliedEvents: 0,
      duplicateEvents: 0,
      unsupportedEvents: 0,
    });
    const liveTrip = live.trips.get('t-1');
    const copiedTrip = copy.trips.get('t-1');
    expect(copiedTrip?.pickups).toEqual(liveTrip?.pickups);
    expect(copiedTrip?.passengersOnBoard).toBe(1);
    expect(copiedTrip?.position).toEqual(liveTrip?.position);
    expect(copiedTrip?.route.track).toEqual(liveTrip?.route.track);
    expect(copiedTrip?.route.travelledKm).toBe(liveTrip?.route.travelledKm);
    expect(copiedTrip?.route.stops).toEqual(liveTrip?.route.stops);
    expect(copy.vehicles.get('v-1')?.status).toBe('on_trip');
    expect(copy.users.get('d-1')?.activeMode).toBe('driver');
    expect(copy.snapshot(takenAt)).toEqual(live.snapshot(takenAt));
  });

  it('evolves on its own without touching the live twin', () => {
    const live = liveTwin();
    const before = live.snapshot(takenAt);
    const copy = SystemTwin.fromSnapshot(before);

    // La réplica sigue desde el último evento del vivo
    copy.apply(event('trip.finished', 't-1', trip('finished')));
    copy.trips
      .get('t-2')
      ?.route.addPosition({ type: 'Point', coordinates: [-2.4, 36.8] });

    expect(copy.trips.get('t-1')?.status).toBe('finished');
    expect(live.snapshot(takenAt)).toEqual(before);
    expect(live.trips.get('t-1')?.status).toBe('in_progress');
  });

  it('ignores the events the live twin had already applied', () => {
    const live = liveTwin();
    const copy = SystemTwin.fromSnapshot(live.snapshot(takenAt));

    const old: TwinEvent = {
      ...event('trip.cancelled', 't-2', trip('cancelled')),
      sequence: live.lastSequence,
    };

    expect(copy.apply(old)).toBe('duplicate');
    expect(copy.trips.get('t-2')?.status).toBe('published');
  });
});
