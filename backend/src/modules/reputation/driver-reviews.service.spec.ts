import { toRatingView } from './driver-reviews.service';

describe('toRatingView', () => {
  it('fills every star from 5 to 1 and rounds the average to 2 decimals', () => {
    const view = toRatingView('driver-1', [
      { rating: 5, count: 2 },
      { rating: 3, count: 1 },
    ]);

    expect(view).toEqual({
      driverId: 'driver-1',
      average: 4.33,
      count: 3,
      distribution: [
        { rating: 5, count: 2 },
        { rating: 4, count: 0 },
        { rating: 3, count: 1 },
        { rating: 2, count: 0 },
        { rating: 1, count: 0 },
      ],
    });
  });

  it('has no average without reviews', () => {
    expect(toRatingView('driver-1', [])).toMatchObject({
      average: null,
      count: 0,
    });
  });
});
