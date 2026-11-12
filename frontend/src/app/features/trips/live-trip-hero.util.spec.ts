import {
  etaTag,
  headingTo,
  isArriving,
  journeyStages,
  liveEtaText,
  stageIndex,
} from './live-trip-hero.util';

describe('live trip hero', () => {
  it('marks the stages done up to the current one', () => {
    expect(stageIndex(true, false)).toBe(0);
    expect(stageIndex(false, false)).toBe(1);
    expect(stageIndex(false, true)).toBe(2);
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
    expect(liveEtaText(null, true, 'Llega', 'Sin posición')).toBeNull();
    expect(
      liveEtaText(
        {
          pickupMinutes: 4,
          destinationMinutes: 10,
          destinationMeters: 1000,
          isTogether: false,
          isStale: true,
        },
        true,
        'Llega',
        'Sin posición',
      ),
    ).toBe('Sin posición');
    expect(
      liveEtaText(
        {
          pickupMinutes: 4,
          destinationMinutes: 10,
          destinationMeters: 1000,
          isTogether: false,
          isStale: false,
        },
        true,
        'Llega',
        'Sin posición',
      ),
    ).toBe('Llega en 4 min');
    expect(
      liveEtaText(
        {
          pickupMinutes: null,
          destinationMinutes: 8,
          destinationMeters: 1000,
          isTogether: false,
          isStale: false,
        },
        false,
        'Llega',
        'Sin posición',
      ),
    ).toBe('En destino en 8 min');
  });
});
