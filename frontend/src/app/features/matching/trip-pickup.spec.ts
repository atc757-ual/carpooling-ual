import { SearchPlace } from '../../core/models/trip-search.model';
import { pickupFact, toRequestPickup } from './trip-pickup';

const PLACE: SearchPlace = {
  id: 'p1',
  name: 'Calle Real, 5',
  locality: 'Almería',
  coordinates: [-2.46, 36.84],
};
const STOP = { id: 's1', name: 'Av. Cabo de Gata', walkingDistanceM: 240 };

describe('pickupFact', () => {
  it('gives the stop, its time and the walk when the driver picks up at stops', () => {
    expect(pickupFact({ pickupDetourMinutes: 4, pickupTime: '07:52', pickupStop: STOP })).toBe(
      'En la parada Av. Cabo de Gata a las 07:52 (a 240 m andando)',
    );
  });

  it('gives the pickup time at the passenger point', () => {
    expect(pickupFact({ pickupDetourMinutes: 4, pickupTime: '07:52' })).toBe(
      'A las 07:52, en tu punto',
    );
  });

  it('falls back to the detour plus the stop when there is no time', () => {
    expect(pickupFact({ pickupDetourMinutes: 4 })).toBe('unos 6 min');
  });
});

describe('toRequestPickup', () => {
  it('sends the stop of a trip that picks up at stops', () => {
    expect(toRequestPickup({ direction: 'to-campus', place: PLACE }, { pickupStop: STOP })).toEqual(
      { direction: 'to-campus', stopId: 's1' },
    );
  });

  it('sends the searched place on the route', () => {
    expect(toRequestPickup({ direction: 'to-campus', place: PLACE }, {})).toEqual({
      direction: 'to-campus',
      location: { type: 'Point', coordinates: [-2.46, 36.84] },
      name: 'Calle Real, 5',
    });
  });

  it('sends only the direction when leaving the campus', () => {
    expect(
      toRequestPickup({ direction: 'from-campus', place: PLACE }, { pickupStop: STOP }),
    ).toEqual({ direction: 'from-campus' });
  });
});
