import { distanceKm, estimateTripImpact } from './trip-impact';

describe('trip impact', () => {
  const ROQUETAS: [number, number] = [-2.6146, 36.7642];
  const CAMPUS: [number, number] = [-2.4058, 36.8291];

  it('measures the straight line between two points', () => {
    expect(distanceKm(ROQUETAS, CAMPUS)).toBeCloseTo(19.8, 0);
  });

  it('estimates the road km, CO2 and fuel saved by sharing the trip', () => {
    expect(estimateTripImpact(ROQUETAS, CAMPUS)).toEqual({ km: 26, co2Kg: 3.1, fuelEuros: 2.6 });
  });

  it('has nothing to save when both points are the same place', () => {
    expect(estimateTripImpact(CAMPUS, CAMPUS)).toBeNull();
  });
});
