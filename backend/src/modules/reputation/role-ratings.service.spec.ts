import { toRoleRatingView } from './role-ratings.service';

describe('toRoleRatingView', () => {
  it('fills every star from 5 to 1 and rounds the average to 2 decimals', () => {
    const view = toRoleRatingView('driver-1', 'driver', [
      { rating: 5, count: 2 },
      { rating: 3, count: 1 },
    ]);

    expect(view).toEqual({
      userId: 'driver-1',
      role: 'driver',
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
    expect(toRoleRatingView('user-1', 'passenger', [])).toMatchObject({
      role: 'passenger',
      average: null,
      count: 0,
    });
  });
});
