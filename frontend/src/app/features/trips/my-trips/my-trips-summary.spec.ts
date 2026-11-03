import {
  formatRoute,
  occupiedSeats,
  savedCo2Kg,
  SharedTrip,
  tripsSummary,
} from './my-trips-summary';

const ROQUETAS_TO_CAMPUS: Omit<SharedTrip, 'carsAvoided'> = {
  origin: { type: 'Point', coordinates: [-2.6146, 36.7642] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
};

describe('my trips summary', () => {
  it('names the route, with placeholders when the names are missing', () => {
    expect(formatRoute({ originName: 'Roquetas de Mar', destinationName: 'Campus UAL' })).toBe(
      'Roquetas de Mar → Campus UAL',
    );
    expect(formatRoute({ originName: null, destinationName: null })).toBe('Origen → Destino');
  });

  it('sums up the upcoming trips and the one in progress', () => {
    expect(tripsSummary(3, 1)).toBe('3 próximos · 1 en curso');
    expect(tripsSummary(1, 0)).toBe('1 próximo');
    expect(tripsSummary(0, 1)).toBe('1 en curso');
    expect(tripsSummary(0, 0)).toBe('Sin viajes programados');
  });

  it('estimates the CO₂ saved, one car per seat taken', () => {
    const once = savedCo2Kg([{ ...ROQUETAS_TO_CAMPUS, carsAvoided: 1 }]);
    expect(once).toBeGreaterThan(0);
    expect(savedCo2Kg([{ ...ROQUETAS_TO_CAMPUS, carsAvoided: 2 }])).toBeCloseTo(once * 2, 1);
    expect(savedCo2Kg([{ ...ROQUETAS_TO_CAMPUS, carsAvoided: 0 }])).toBe(0);
    expect(savedCo2Kg([])).toBe(0);
  });

  it('counts the seats taken in a trip', () => {
    expect(occupiedSeats({ offeredSeats: 3, availableSeats: 1 })).toBe(2);
  });
});
