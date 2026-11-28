import { SystemTwin } from './system-twin';
import type { TwinEvent } from './twin-event';
import type { SystemTwinSnapshot } from './twin-snapshot';

let nextSequence = 0;

function event(
  type: string,
  sourceEntityId: string,
  payload: Record<string, unknown> = {},
): TwinEvent {
  nextSequence += 1;
  return {
    id: `event-${nextSequence}`,
    sequence: nextSequence,
    type,
    version: 1,
    sourceEntityId,
    payload,
    occurredAt: new Date(Date.UTC(2026, 10, 28, 8, 0, nextSequence)),
  };
}

const point = (lng: number, lat: number) => ({
  type: 'Point',
  coordinates: [lng, lat],
});

function trip(status: string): Record<string, unknown> {
  return {
    driverId: 'd-1',
    vehicleId: 'v-1',
    status,
    departureAt: '2026-11-28T08:30:00.000Z',
    offeredSeats: 3,
    availableSeats: 2,
    startedAt: status === 'in_progress' ? '2026-11-28T08:31:00.000Z' : null,
    origin: point(-2.6, 36.8),
    destination: point(-2.41, 36.83),
    stops: [
      { id: 's-1', position: 1, name: 'Plaza', location: point(-2.5, 36.81) },
    ],
  };
}

// Un gemelo vivo con un viaje en curso (con una pasajera a bordo y dos
// posiciones), otro publicado, su vehículo y dos usuarios
function liveTwin(): SystemTwin {
  nextSequence = 0;
  const twin = new SystemTwin();
  twin.apply(
    event('user.registered', 'd-1', { profiles: ['driver', 'passenger'] }),
  );
  twin.apply(
    event('user.active_mode_changed', 'd-1', { activeMode: 'driver' }),
  );
  twin.apply(event('user.registered', 'p-1', { profiles: ['passenger'] }));
  twin.apply(event('trip.published', 't-1', trip('published')));
  twin.apply(
    event('request.accepted', 'r-1', {
      tripId: 't-1',
      passengerId: 'p-1',
      seats: 1,
      status: 'accepted',
      pickupLocation: point(-2.55, 36.8),
      pickupAt: '2026-11-28T08:40:00.000Z',
    }),
  );
  twin.apply(event('trip.started', 't-1', trip('in_progress')));
  twin.apply(
    event('request.boarded', 'r-1', {
      tripId: 't-1',
      status: 'accepted',
      boardedAt: '2026-11-28T08:41:00.000Z',
    }),
  );
  for (const [lng, recordedAt] of [
    [-2.55, '2026-11-28T08:42:00.000Z'],
    [-2.5, '2026-11-28T08:45:00.000Z'],
  ] as const) {
    twin.apply(
      event('trip.position_updated', 't-1', {
        position: point(lng, 36.81),
        recordedAt,
        remainingKm: 8,
        remainingMin: 12,
      }),
    );
  }
  twin.apply(event('trip.published', 't-2', { ...trip('published') }));
  return twin;
}

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
