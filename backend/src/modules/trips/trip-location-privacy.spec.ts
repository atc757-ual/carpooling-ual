import type { Point } from 'typeorm';
import {
  APPROXIMATE_GRID_DEGREES,
  approximatePoint,
} from './trip-location-privacy';

const point = (lon: number, lat: number): Point => ({
  type: 'Point',
  coordinates: [lon, lat],
});

describe('approximatePoint', () => {
  it('moves the point to the centre of its grid cell', () => {
    expect(approximatePoint(point(-2.40551, 36.83812))).toEqual(
      point(-2.405, 36.84),
    );
  });

  it('gives the same point to every address of the same cell', () => {
    const first = approximatePoint(point(-2.4061, 36.8384));
    const second = approximatePoint(point(-2.4039, 36.8396));

    expect(first).toEqual(second);
  });

  it('never moves it more than half a cell on each axis', () => {
    const original = point(-2.40749, 36.83251);
    const [lon, lat] = approximatePoint(original).coordinates;

    expect(Math.abs(lon - original.coordinates[0])).toBeLessThanOrEqual(
      APPROXIMATE_GRID_DEGREES / 2,
    );
    expect(Math.abs(lat - original.coordinates[1])).toBeLessThanOrEqual(
      APPROXIMATE_GRID_DEGREES / 2,
    );
  });
});
