import { etaTag, headingTo, isArriving, journeyStages } from './live-trip-hero.util';

describe('live trip hero', () => {
  it('marks the stages done up to the current one', () => {
    expect(journeyStages(['A', 'B', 'C'], 1)).toEqual([
      { label: 'A', state: 'done' },
      { label: 'B', state: 'current' },
      { label: 'C', state: 'upcoming' },
    ]);
  });

  it('is arriving within 300 m, and not without a position', () => {
    expect(isArriving(250)).toBe(true);
    expect(isArriving(301)).toBe(false);
    expect(isArriving(null)).toBe(false);
  });

  it('heads to the campus or home, and arrives only at the campus', () => {
    expect(headingTo(true, false)).toBe('Rumbo al campus');
    expect(headingTo(true, true)).toBe('Llegando al campus');
    expect(headingTo(false, true)).toBe('Rumbo a casa');
  });

  it('says the minutes in words, and «Llegando» with one or less', () => {
    expect(etaTag(9.6, 'En destino')).toBe('En destino en 10 min');
    expect(etaTag(1, 'Llega')).toBe('Llegando');
  });
});
