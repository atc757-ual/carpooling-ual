import { TripTwin } from './trip-twin';
import type { TwinEvent } from './twin-event';

const TRIP_ID = 'trip-1';
const POINT = { type: 'Point', coordinates: [-2.4, 36.83] };

function event(
  type: string,
  payload: Record<string, unknown>,
  sourceEntityId = TRIP_ID,
): TwinEvent {
  return {
    id: `${type}-${sourceEntityId}`,
    sequence: 1,
    type,
    version: 1,
    sourceEntityId,
    payload,
    occurredAt: new Date('2026-11-03T08:00:00Z'),
  };
}

function tripState(
  status: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    driverId: 'driver-1',
    vehicleId: 'vehicle-1',
    departureAt: '2026-11-03T08:30:00.000Z',
    offeredSeats: 3,
    availableSeats: 2,
    status,
    startedAt: null,
    ...extra,
  };
}

function request(
  status: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return { tripId: TRIP_ID, passengerId: 'p-1', seats: 1, status, ...extra };
}

describe('TripTwin', () => {
  let trip: TripTwin;

  beforeEach(() => {
    trip = new TripTwin(TRIP_ID);
  });

  it.each([
    ['trip.published', 'published'],
    ['trip.updated', 'published'],
    ['trip.confirmed', 'confirmed'],
    ['trip.reopened', 'published'],
    ['trip.started', 'in_progress'],
    ['trip.finished', 'finished'],
    ['trip.cancelled', 'cancelled'],
  ])('takes the whole state from %s', (type, status) => {
    expect(trip.apply(event(type, tripState(status)))).toBe(true);

    expect(trip).toMatchObject({
      status,
      driverId: 'driver-1',
      vehicleId: 'vehicle-1',
      offeredSeats: 3,
      availableSeats: 2,
      seatsTaken: 1,
      departureAt: new Date('2026-11-03T08:30:00.000Z'),
      updatedAt: new Date('2026-11-03T08:00:00Z'),
    });
  });

  it('ignores a status it does not know and keeps the last one', () => {
    trip.apply(event('trip.published', tripState('published')));
    trip.apply(event('trip.updated', tripState('teleported')));

    expect(trip.status).toBe('published');
  });

  it('reads finishedAt and finishDistanceM from trip.finished v2', () => {
    trip.apply(
      event(
        'trip.finished',
        tripState('finished', {
          finishedAt: '2026-11-03T09:00:00.000Z',
          finishDistanceM: 40,
        }),
      ),
    );

    expect(trip.finishedAt).toEqual(new Date('2026-11-03T09:00:00.000Z'));
    expect(trip.finishDistanceM).toBe(40);
    expect(trip.isClosed).toBe(true);
  });

  it('leaves them empty with trip.finished v1', () => {
    trip.apply(event('trip.finished', tripState('finished')));

    expect(trip.finishedAt).toBeNull();
    expect(trip.finishDistanceM).toBeNull();
  });

  it('keeps the last position only while in progress', () => {
    const position = event('trip.position_updated', {
      position: POINT,
      recordedAt: '2026-11-03T08:40:00.000Z',
      remainingKm: 4.2,
      remainingMin: 9,
    });
    trip.apply(event('trip.confirmed', tripState('confirmed')));
    trip.apply(position);
    expect(trip.position).toBeNull();

    trip.apply(event('trip.started', tripState('in_progress')));
    trip.apply(position);
    expect(trip).toMatchObject({
      position: POINT,
      positionAt: new Date('2026-11-03T08:40:00.000Z'),
      remainingKm: 4.2,
      remainingMin: 9,
    });

    trip.apply(event('trip.finished', tripState('finished')));
    expect(trip).toMatchObject({
      position: null,
      positionAt: null,
      remainingKm: null,
      remainingMin: null,
    });
  });

  it('drops a malformed position', () => {
    trip.apply(event('trip.started', tripState('in_progress')));
    trip.apply(event('trip.position_updated', { position: { type: 'Line' } }));

    expect(trip.position).toBeNull();
  });

  it('follows its requests and counts the passengers on board', () => {
    trip.apply(event('request.created', request('pending'), 'r-1'));
    trip.apply(
      event('request.created', request('pending', { seats: 2 }), 'r-2'),
    );
    expect(trip.requests.get('r-1')).toEqual({
      passengerId: 'p-1',
      seats: 1,
      status: 'pending',
      isBoarded: false,
    });

    trip.apply(event('request.accepted', request('accepted'), 'r-1'));
    trip.apply(
      event('request.accepted', request('accepted', { seats: 2 }), 'r-2'),
    );
    trip.apply(
      event(
        'request.boarded',
        request('accepted', { seats: 2, boardedAt: '2026-11-03T08:35:00Z' }),
        'r-2',
      ),
    );
    expect(trip.passengersOnBoard).toBe(2);

    trip.apply(
      event(
        'request.cancelled',
        request('cancelled', { seats: 2, boardedAt: '2026-11-03T08:35:00Z' }),
        'r-2',
      ),
    );
    expect(trip.passengersOnBoard).toBe(0);
    expect(trip.requests.size).toBe(2);
  });

  it('takes one seat and pending when the request payload lacks them', () => {
    trip.apply(event('request.created', { tripId: TRIP_ID }, 'r-1'));

    expect(trip.requests.get('r-1')).toMatchObject({
      seats: 1,
      status: 'pending',
    });
  });

  it('does not apply events that are not about trips or requests', () => {
    expect(trip.apply(event('user.updated', {}))).toBe(false);
    expect(trip.updatedAt).toBeNull();
  });
});
