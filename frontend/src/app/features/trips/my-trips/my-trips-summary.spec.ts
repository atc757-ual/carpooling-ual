import { formatRoute, occupiedSeats } from './my-trips-summary';

describe('my trips summary', () => {
  it('names the route, with placeholders when the names are missing', () => {
    expect(formatRoute({ originName: 'Roquetas de Mar', destinationName: 'Campus UAL' })).toBe(
      'Roquetas de Mar → Campus UAL',
    );
    expect(formatRoute({ originName: null, destinationName: null })).toBe('Origen → Destino');
  });

  it('counts the seats taken in a trip', () => {
    expect(occupiedSeats({ offeredSeats: 3, availableSeats: 1 })).toBe(2);
  });
});
