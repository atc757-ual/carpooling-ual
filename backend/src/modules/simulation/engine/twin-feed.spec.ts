import { EVENT_VERSIONS } from '../../../events/event-versions';
import {
  SUPPORTED_EVENT_VERSIONS,
  SystemTwin,
} from '../../digital-twin/model/system-twin';
import type { TwinEvent } from '../../digital-twin/model/twin-event';
import type { ScenarioConfig } from '../scenario-config';
import { simulateDay } from './agent-replica';
import { createRandom } from './population';
import { liveTwin } from '../../digital-twin/model/live-twin.testing';
import { protectSnapshot } from '../../digital-twin/model/twin-snapshot-privacy';
import { TwinFeed } from './twin-feed';

// Contrato de eventos con dos consumidores (RNF-13): el gemelo vivo de la
// plataforma (sus tests en digital-twin) y el de cada réplica de la
// simulación, que recibe eventos generados por el motor. Aquí se comprueba que
// los del motor son eventos del contrato de la plataforma, en una versión que
// el gemelo sabe leer
const SCENARIO: ScenarioConfig = {
  code: 'S5',
  name: 'Incidencias',
  users: 3000,
  adoptionRate: 0.5,
  modalSplit: { own_car: 0.5, public_transport: 0.5 },
  timeWindowMin: 15,
  parameters: { cancellationRate: 0.4 },
};

describe('twin feed (event contract)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('only emits platform event types, in versions the twin reads', () => {
    // Sin sustituirlo: el gemelo de la réplica sigue aplicando los eventos
    const apply = jest.spyOn(SystemTwin.prototype, 'apply');

    simulateDay(SCENARIO, createRandom(4));

    const events = apply.mock.calls.map(([event]): TwinEvent => event);
    const types = new Set(events.map(({ type }) => type));
    // Todo el ciclo de vida que usa el motor: las cancelaciones (S5) y los
    // viajes que caducan sin pasajeros
    expect([...types].sort()).toEqual([
      'request.accepted',
      'request.boarded',
      'request.cancelled',
      'request.created',
      'trip.cancelled',
      'trip.expired',
      'trip.finished',
      'trip.published',
      'trip.started',
      'trip.updated',
    ]);
    for (const event of events) {
      expect(Object.keys(EVENT_VERSIONS)).toContain(event.type);
      expect(SUPPORTED_EVENT_VERSIONS[event.type]?.has(event.version)).toBe(
        true,
      );
      expect(event.version).toBeLessThanOrEqual(
        EVENT_VERSIONS[event.type as keyof typeof EVENT_VERSIONS],
      );
    }
  });

  it('leaves the replica twin as the platform twin would be after a trip', () => {
    const feed = new TwinFeed();
    const trip = { vehicleId: 'v1', seats: 3 };

    feed.trip('trip.published', 't1', {
      ...trip,
      status: 'published',
      free: 3,
    });
    feed.request('request.created', 'p1', { tripId: 't1', status: 'pending' });
    feed.request('request.accepted', 'p1', {
      tripId: 't1',
      status: 'accepted',
    });
    feed.trip('trip.started', 't1', {
      ...trip,
      status: 'in_progress',
      free: 2,
    });
    feed.request('request.boarded', 'p1', {
      tripId: 't1',
      status: 'accepted',
      isBoarded: true,
    });

    expect(feed.twin.trips.get('t1')?.status).toBe('in_progress');
    expect(feed.twin.vehicles.get('v1')?.status).toBe('on_trip');
    expect(feed.twin.summary().passengersOnBoard).toBe(1);

    feed.trip('trip.finished', 't1', { ...trip, status: 'finished', free: 2 });

    const summary = feed.twin.summary();
    expect(feed.twin.trips.get('t1')?.status).toBe('finished');
    expect(feed.twin.vehicles.get('v1')?.status).toBe('idle');
    expect(summary).toMatchObject({
      appliedEvents: 6,
      duplicateEvents: 0,
      unsupportedEvents: 0,
    });
  });
});

// La réplica arranca de la copia del gemelo vivo (lo acordado con el director
// el 27/10/2026), ya protegida como se guarda con la ejecución
describe('twin feed from a copy of the live twin', () => {
  const copy = () =>
    protectSnapshot(liveTwin().snapshot(new Date('2026-11-28T08:46:00Z')));

  it('starts with the open trips of the copy and keeps them apart', () => {
    const feed = new TwinFeed(copy());

    expect([...feed.copiedTripIds]).toEqual(['viaje-1', 'viaje-2']);
    expect(feed.twin.trips.get('viaje-1')?.status).toBe('in_progress');
    expect(feed.twin.summary().passengersOnBoard).toBe(1);
  });

  it('follows the sequence of the copy, so its events are not duplicates', () => {
    const snapshot = copy();
    const feed = new TwinFeed(snapshot);

    feed.trip('trip.published', 't1', {
      vehicleId: 'v1',
      status: 'published',
      seats: 3,
      free: 3,
    });

    expect(feed.twin.lastSequence).toBe(snapshot.lastSequence + 1);
    expect(feed.twin.trips.get('t1')?.status).toBe('published');
    expect(feed.twin.summary()).toMatchObject({
      appliedEvents: 1,
      duplicateEvents: 0,
    });
  });
});
