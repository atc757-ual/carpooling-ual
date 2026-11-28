import { SystemTwin } from './system-twin';
import type { TwinEvent } from './twin-event';

// Un gemelo vivo de prueba (tests del snapshot y de su protección)
let nextSequence = 0;

export function event(
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

export const point = (lng: number, lat: number) => ({
  type: 'Point',
  coordinates: [lng, lat],
});

export function trip(status: string): Record<string, unknown> {
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
export function liveTwin(): SystemTwin {
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
