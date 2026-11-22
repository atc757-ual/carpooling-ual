import type { Point } from 'typeorm';
import { savedCo2Kg, sharedKm, straightLineKm } from './saved-co2';

const ROQUETAS: Point = { type: 'Point', coordinates: [-2.6147, 36.7642] };
const UAL_CAMPUS: Point = { type: 'Point', coordinates: [-2.4048, 36.8295] };

describe('saved CO₂', () => {
  it('measures the straight line between two points', () => {
    // Roquetas de Mar - campus: unos 20 km en línea recta
    expect(straightLineKm(ROQUETAS, UAL_CAMPUS)).toBeCloseTo(20, 0);
    expect(straightLineKm(UAL_CAMPUS, UAL_CAMPUS)).toBe(0);
  });

  it('counts the CO₂ of one car per car avoided, like the app', () => {
    const once = savedCo2Kg([
      { origin: ROQUETAS, destination: UAL_CAMPUS, carsAvoided: 1 },
    ]);
    // 20 km × 1,3 (carretera) × 0,12 kg/km, redondeado a 0,1 kg
    expect(once).toBe(3.1);
    expect(
      savedCo2Kg([
        { origin: ROQUETAS, destination: UAL_CAMPUS, carsAvoided: 2 },
        { origin: UAL_CAMPUS, destination: ROQUETAS, carsAvoided: 1 },
      ]),
    ).toBe(9.3);
  });

  it('adds up the road km of the legs where the car was shared', () => {
    const shared = sharedKm([
      { origin: ROQUETAS, destination: UAL_CAMPUS, carsAvoided: 2 },
      { origin: UAL_CAMPUS, destination: ROQUETAS, carsAvoided: 0 },
    ]);
    // Unos 20 km × 1,3 (carretera); el viaje sin pasajeros no cuenta
    expect(shared).toBeCloseTo(26, 0);
    expect(sharedKm([])).toBe(0);
    expect(
      sharedKm([
        { origin: UAL_CAMPUS, destination: UAL_CAMPUS, carsAvoided: 1 },
      ]),
    ).toBe(0);
  });

  it('saves nothing without trips or when origin and destination match', () => {
    expect(savedCo2Kg([])).toBe(0);
    expect(
      savedCo2Kg([
        { origin: UAL_CAMPUS, destination: UAL_CAMPUS, carsAvoided: 3 },
      ]),
    ).toBe(0);
  });
});
