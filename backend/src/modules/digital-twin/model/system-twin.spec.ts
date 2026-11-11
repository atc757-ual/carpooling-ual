import { EVENT_VERSIONS } from '../../../events/event-versions';
import type { DomainEventType } from '../../../events/domain-event-type';
import { SUPPORTED_EVENT_VERSIONS, SystemTwin } from './system-twin';
import type { TwinEvent } from './twin-event';

let nextSequence = 0;

function event(
  type: string,
  sourceEntityId: string,
  payload: Record<string, unknown> = {},
  version = 1,
): TwinEvent {
  nextSequence += 1;
  return {
    id: `event-${nextSequence}`,
    sequence: nextSequence,
    type,
    version,
    sourceEntityId,
    payload,
    occurredAt: new Date(Date.UTC(2026, 10, 3, 8, 0, nextSequence)),
  };
}

function trip(status: string, vehicleId = 'v-1'): Record<string, unknown> {
  return {
    driverId: 'd-1',
    vehicleId,
    status,
    offeredSeats: 3,
    availableSeats: 3,
  };
}

describe('SystemTwin', () => {
  let twin: SystemTwin;

  beforeEach(() => {
    nextSequence = 0;
    twin = new SystemTwin();
  });

  it('accepts the current version of every type it reads', () => {
    for (const [type, versions] of Object.entries(SUPPORTED_EVENT_VERSIONS)) {
      expect(versions.has(EVENT_VERSIONS[type as DomainEventType])).toBe(true);
    }
  });

  it('creates the twins of a trip and its vehicle and counts them', () => {
    expect(twin.apply(event('trip.published', 't-1', trip('published')))).toBe(
      'applied',
    );
    twin.apply(event('trip.published', 't-2', trip('published', 'v-2')));
    twin.apply(event('trip.started', 't-2', trip('in_progress', 'v-2')));

    expect(twin.summary()).toEqual({
      trips: {
        published: 1,
        confirmed: 0,
        in_progress: 1,
        finished: 0,
        cancelled: 0,
        expired: 0,
      },
      vehicles: { idle: 0, scheduled: 1, on_trip: 1 },
      users: {
        active: 0,
        deactivated: 0,
        drivers: 0,
        passengers: 0,
        inDriverMode: 0,
      },
      passengersOnBoard: 0,
      lastSequence: 3,
      appliedEvents: 3,
      duplicateEvents: 0,
      unsupportedEvents: 0,
      lastEventAt: new Date(Date.UTC(2026, 10, 3, 8, 0, 3)),
    });
  });

  it('ignores the events already applied, by sequence or by id', () => {
    const published = event('trip.published', 't-1', trip('published'));
    twin.apply(published);

    expect(twin.apply(published)).toBe('duplicate');
    expect(twin.apply({ ...published, sequence: 9 })).toBe('duplicate');
    expect(twin.summary()).toMatchObject({
      lastSequence: 1,
      appliedEvents: 1,
      duplicateEvents: 2,
    });
  });

  it('advances the sequence with types it does not read yet', () => {
    expect(twin.apply(event('user.updated', 'u-1'))).toBe('ignored');

    expect(twin.summary()).toMatchObject({ lastSequence: 1, appliedEvents: 0 });
  });

  it('discards an unknown version and counts it', () => {
    expect(
      twin.apply(event('trip.published', 't-1', trip('published'), 99)),
    ).toBe('unsupported');

    expect(twin.trips.size).toBe(0);
    expect(twin.summary()).toMatchObject({
      lastSequence: 1,
      unsupportedEvents: 1,
    });
  });

  it('reads trip.started and trip.finished in v1 and v2', () => {
    twin.apply(event('trip.started', 't-3', trip('in_progress'), 2));
    twin.apply(event('trip.finished', 't-1', trip('finished')));
    twin.apply(event('trip.finished', 't-2', trip('finished'), 2));

    expect(twin.summary().trips).toMatchObject({ finished: 2, in_progress: 1 });
  });

  it('sends the positions to the trip and its vehicle', () => {
    const position = {
      position: { type: 'Point', coordinates: [-2.4, 36.83] },
      recordedAt: '2026-11-03T08:40:00.000Z',
    };
    expect(twin.apply(event('trip.position_updated', 't-1', position))).toBe(
      'ignored',
    );
    twin.apply(event('trip.started', 't-1', trip('in_progress')));

    expect(twin.apply(event('trip.position_updated', 't-1', position))).toBe(
      'applied',
    );
    expect(twin.trips.get('t-1')?.position).toEqual(position.position);
    expect(twin.vehicles.get('v-1')?.position).toEqual(position.position);
  });

  it('sends the requests to their trip', () => {
    twin.apply(event('trip.published', 't-1', trip('published')));

    expect(
      twin.apply(event('request.created', 'r-1', { tripId: 't-1', seats: 2 })),
    ).toBe('applied');
    expect(twin.apply(event('request.created', 'r-2', { tripId: 't-9' }))).toBe(
      'ignored',
    );
    expect(twin.apply(event('request.created', 'r-3'))).toBe('ignored');
    expect(twin.trips.get('t-1')?.requests.get('r-1')?.seats).toBe(2);
  });

  it('frees the previous vehicle when a trip changes vehicle', () => {
    twin.apply(event('trip.published', 't-1', trip('published', 'v-1')));
    twin.apply(event('trip.updated', 't-1', trip('published', 'v-2')));

    expect(twin.vehicles.get('v-1')?.status).toBe('idle');
    expect(twin.vehicles.get('v-2')?.status).toBe('scheduled');
  });

  it('keeps a trip without vehicle out of the vehicles', () => {
    twin.apply(event('trip.published', 't-1', trip('published')));
    twin.apply(event('trip.published', 't-2', { status: 'published' }));

    expect(twin.vehicles.size).toBe(1);
    expect(twin.summary().trips.published).toBe(2);
  });

  it('remembers a bounded number of recent ids', () => {
    for (let index = 0; index < 1005; index += 1) {
      twin.apply(event('user.updated', 'u-1'));
    }
    // El primero ya se ha olvidado: con una secuencia nueva, se acepta
    expect(twin.apply({ ...event('user.updated', 'u-1'), id: 'event-1' })).toBe(
      'ignored',
    );
  });

  it('counts the users by account, profile and mode', () => {
    twin.apply(event('user.registered', 'u-1', { profiles: ['driver'] }));
    twin.apply(event('user.registered', 'u-2', { profiles: ['passenger'] }));
    twin.apply(
      event('user.active_mode_changed', 'u-1', { activeMode: 'driver' }),
    );
    twin.apply(event('user.profile_activated', 'u-3', { profile: 'driver' }));
    twin.apply(event('user.deactivated', 'u-3'));

    expect(twin.summary().users).toEqual({
      active: 2,
      deactivated: 1,
      drivers: 1,
      passengers: 1,
      inDriverMode: 1,
    });
  });

  it('counts the passengers on board of the trips in progress', () => {
    const boarded = (tripId: string) =>
      event('request.boarded', `r-${tripId}`, {
        tripId,
        seats: 2,
        status: 'accepted',
        boardedAt: '2026-11-04T08:00:00Z',
      });
    twin.apply(event('trip.started', 't-1', trip('in_progress')));
    twin.apply(event('trip.finished', 't-2', trip('finished', 'v-2')));
    twin.apply(boarded('t-1'));
    twin.apply(boarded('t-2'));

    expect(twin.summary().passengersOnBoard).toBe(2);
  });
});
