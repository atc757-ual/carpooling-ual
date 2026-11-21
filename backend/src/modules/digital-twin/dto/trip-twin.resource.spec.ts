import { TripTwin } from '../model/trip-twin';
import type { TwinEvent } from '../model/twin-event';
import { toTripTwinResource } from './trip-twin.resource';

const ORIGIN = { type: 'Point', coordinates: [-2.6, 36.75] };
const CAMPUS = { type: 'Point', coordinates: [-2.4048, 36.8295] };

function event(
  type: string,
  payload: Record<string, unknown>,
  sourceEntityId = 'trip-1',
): TwinEvent {
  return {
    id: `${type}-${sourceEntityId}-${JSON.stringify(payload).length}`,
    sequence: 1,
    type,
    version: 1,
    sourceEntityId,
    payload,
    occurredAt: new Date('2026-11-03T08:00:00Z'),
  };
}

describe('toTripTwinResource', () => {
  it('gives the trip with its route: pickups, track as a LineString and the km', () => {
    const trip = new TripTwin('trip-1');
    trip.apply(
      event('trip.started', {
        status: 'in_progress',
        offeredSeats: 3,
        availableSeats: 2,
        departureAt: '2026-11-03T08:30:00.000Z',
        origin: ORIGIN,
        destination: CAMPUS,
        stops: [],
      }),
    );
    trip.apply(
      event(
        'request.accepted',
        {
          status: 'accepted',
          seats: 1,
          pickupLocation: ORIGIN,
          pickupAt: '2026-11-03T08:35:00.000Z',
        },
        'request-1',
      ),
    );
    trip.apply(event('trip.position_updated', { position: ORIGIN }));
    trip.apply(event('trip.position_updated', { position: CAMPUS }));

    const resource = toTripTwinResource(trip);

    expect(resource).toMatchObject({
      '@type': 'TripTwin',
      id: 'trip-1',
      href: '/api/admin/digital-twin/trips/trip-1',
      status: 'in_progress',
      departureAt: '2026-11-03T08:30:00.000Z',
      position: CAMPUS,
    });
    expect(resource.route.pickups).toEqual([
      {
        requestId: 'request-1',
        point: ORIGIN,
        stopId: null,
        pickupAt: '2026-11-03T08:35:00.000Z',
        isBoarded: false,
      },
    ]);
    expect(resource.route.track).toEqual({
      type: 'LineString',
      coordinates: [ORIGIN.coordinates, CAMPUS.coordinates],
    });
    expect(resource.route.trackPoints).toBe(2);
    expect(resource.route.travelledKm).toBeGreaterThan(0);
  });

  it('has no track with fewer than two positions and empty dates when unknown', () => {
    const resource = toTripTwinResource(new TripTwin('trip-2'));

    expect(resource.route.track).toBeNull();
    expect(resource).toMatchObject({
      status: null,
      departureAt: null,
      positionAt: null,
      updatedAt: null,
    });
  });
});
