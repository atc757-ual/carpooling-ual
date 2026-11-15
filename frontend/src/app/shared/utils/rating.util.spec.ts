import { formatRating, formatRatingSummary, ratingName } from './rating.util';

describe('rating.util', () => {
  it('names each point of the scale, rounding and clamping', () => {
    expect(ratingName(1)).toBe('Muy mal');
    expect(ratingName(3)).toBe('Normal');
    expect(ratingName(4.6)).toBe('Muy bien');
    expect(ratingName(0)).toBe('Muy mal');
    expect(ratingName(9)).toBe('Muy bien');
  });

  it('formats the average with one decimal and the count', () => {
    expect(formatRating(4.56)).toBe('4,6 de 5');
    expect(formatRating(4)).toBe('4,0 de 5');
    expect(formatRatingSummary(4.8, 12)).toBe('4,8 de 5 · 12 valoraciones');
    expect(formatRatingSummary(5, 1)).toBe('5,0 de 5 · 1 valoración');
  });
});
