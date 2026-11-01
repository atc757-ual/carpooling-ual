import {
  areTogether,
  distanceMeters,
  estimatePickupMinutes,
  interpolateLatLng,
  shouldRenderPassengerMarker,
} from './live-trip-map.utils';

describe('live trip map utilities', () => {
  it('measures distance between GeoJSON points in meters', () => {
    expect(distanceMeters([-2.46, 36.84], [-2.46, 36.84])).toBe(0);
    expect(distanceMeters([0, 0], [0, 0.001])).toBeGreaterThan(100);
  });

  it('estimates pickup time at 30 km/h with a one minute minimum', () => {
    expect(estimatePickupMinutes([0, 0], [0.009, 0])).toBe(2);
    expect(estimatePickupMinutes([0, 0], [0.00001, 0])).toBe(1);
  });

  it('treats the passenger as in the car within 30 meters', () => {
    expect(areTogether([0, 0], [0.0001, 0])).toBe(true);
    expect(areTogether([0, 0], [0.001, 0])).toBe(false);
  });

  it('hides the passenger marker only when the car is within range', () => {
    expect(shouldRenderPassengerMarker(null, [0, 0])).toBe(true);
    expect(shouldRenderPassengerMarker([0, 0], [0.0001, 0])).toBe(false);
    expect(shouldRenderPassengerMarker([0, 0], [0.001, 0])).toBe(true);
    expect(shouldRenderPassengerMarker([0, 0], null)).toBe(false);
  });

  it('interpolates marker coordinates and clamps progress', () => {
    expect(interpolateLatLng([0, 0], [10, 20], 0.5)).toEqual([5, 10]);
    expect(interpolateLatLng([0, 0], [10, 20], 2)).toEqual([10, 20]);
  });
});
