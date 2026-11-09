import { EVENT_VERSIONS } from '../../../events/event-versions';
import {
  SUPPORTED_EVENT_VERSIONS,
  SystemTwin,
} from '../../digital-twin/model/system-twin';
import type { TwinEvent } from '../../digital-twin/model/twin-event';
import type { ScenarioConfig } from '../scenario-config';
import { simulateDay } from './agent-replica';
import { createRandom } from './population';
import { TwinFeed } from './twin-feed';

// Contrato de eventos con dos consumidores (RNF-13): el gemelo vivo de la
// plataforma (sus tests en digital-twin) y el de cada réplica de la
// simulación, que recibe eventos generados por el motor. Aquí se comprueba que
// los del motor son eventos del contrato de la plataforma, en una versión que
// el gemelo sabe leer
const SCENARIO: ScenarioConfig = {
  code: 'S5',
  name: 'Incidencias',
  users: 300,
  adoptionRate: 0.5,
  modalSplit: { own_car: 0.5, public_transport: 0.5 },
  timeWindowMin: 15,
  parameters: { cancellationRate: 0.2 },
};

describe('twin feed (event contract)', () => {
  afterEach(() => jest.restoreAllMocks());

  it('only emits platform event types, in versions the twin reads', () => {
    // Sin sustituirlo: el gemelo de la réplica sigue aplicando los eventos
    const apply = jest.spyOn(SystemTwin.prototype, 'apply');

    simulateDay(SCENARIO, createRandom(4));

    const events = apply.mock.calls.map(([event]): TwinEvent => event);
    const types = new Set(events.map(({ type }) => type));
    // Todo el ciclo de vida que usa el motor, también las cancelaciones (S5)
    expect([...types].sort()).toEqual([
      'request.accepted',
      'request.boarded',
      'request.cancelled',
      'request.created',
      'trip.cancelled',
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
