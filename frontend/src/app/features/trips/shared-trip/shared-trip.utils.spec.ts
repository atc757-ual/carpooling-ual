import { SharedTrip } from '../../../core/models/trip-share.model';
import {
  describeSharedTrip,
  describeSharedVehicle,
  isPositionStale,
  routeEnds,
  STALE_POSITION_MS,
} from './shared-trip.utils';

function sharedTrip(changes: Partial<SharedTrip> = {}): SharedTrip {
  return {
    id: 's1',
    tripStatus: 'confirmed',
    passengerState: 'waiting',
    pickupName: 'Rambla',
    pickupAt: '2026-11-14T07:40:00.000Z',
    destinationName: 'Parking P1',
    estimatedArrivalAt: '2026-11-14T08:00:00.000Z',
    driver: { firstName: 'Lucía' },
    vehicle: { brand: 'Seat', model: 'Ibiza', color: 'red', colorName: 'Rojo', plate: '1234ABC' },
    position: null,
    route: null,
    ...changes,
  };
}

describe('shared trip utils', () => {
  it.each([
    [{}, 'Esperando la recogida', 'info'],
    [{ tripStatus: 'in_progress' as const }, 'Esperando la recogida', 'info'],
    [
      { tripStatus: 'in_progress' as const, passengerState: 'on_board' as const },
      'En el coche',
      'success',
    ],
    [
      { tripStatus: 'finished' as const, passengerState: 'finished' as const },
      'El viaje ha terminado',
      'success',
    ],
    [
      { tripStatus: 'cancelled' as const, passengerState: 'finished' as const },
      'El viaje se ha cancelado',
      'neutral',
    ],
  ])('describes %o', (changes, title, tone) => {
    expect(describeSharedTrip(sharedTrip(changes), 'Mario')).toMatchObject({ title, tone });
  });

  it('says the driver is on the way while in progress', () => {
    expect(
      describeSharedTrip(sharedTrip({ tripStatus: 'in_progress' }), 'Mario').description,
    ).toContain('ya ha salido');
  });

  it('describes the car with what is known', () => {
    expect(describeSharedVehicle(sharedTrip().vehicle)).toBe('Seat Ibiza · Rojo · 1234 ABC');
    expect(
      describeSharedVehicle({
        brand: null,
        model: null,
        color: null,
        colorName: null,
        plate: null,
      }),
    ).toBeNull();
    expect(describeSharedVehicle(null)).toBeNull();
  });

  it('takes the route ends for the map', () => {
    const ends = routeEnds(
      {
        type: 'LineString',
        coordinates: [
          [-2.46, 36.84],
          [-2.43, 36.83],
          [-2.4, 36.82],
        ],
      },
      'Parking P1',
    );

    expect(ends?.origin.coordinates).toEqual([-2.46, 36.84]);
    expect(ends?.destination).toEqual({ coordinates: [-2.4, 36.82], label: 'Parking P1' });
    expect(routeEnds({ type: 'LineString', coordinates: [[-2.4, 36.8]] }, null)).toBeNull();
  });

  it('knows when the position is old', () => {
    const now = Date.parse('2026-11-14T08:00:00.000Z');

    expect(isPositionStale('2026-11-14T07:59:30.000Z', now)).toBe(false);
    expect(isPositionStale(new Date(now - STALE_POSITION_MS - 1).toISOString(), now)).toBe(true);
  });
});
