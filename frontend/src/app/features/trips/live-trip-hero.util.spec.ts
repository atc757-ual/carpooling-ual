import {
  etaTag,
  headingTo,
  isArriving,
  journeyStages,
  liveEtaText,
  stageIndex,
} from './live-trip-hero.util';
import { translateEs } from '../../core/i18n/testing-translate';

const PASSENGER_KEYS = {
  keys: { pickup: 'live.hero.arrivesIn', stale: 'live.hero.noPosition' },
  translate: translateEs,
};

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
    expect(translateEs(headingTo(true, false))).toBe('Rumbo al campus');
    expect(translateEs(headingTo(true, true))).toBe('Llegando al campus');
    expect(translateEs(headingTo(false, true))).toBe('Rumbo a casa');
  });

  it('says the minutes in words, and «Llegando» with one or less', () => {
    expect(etaTag(9.6, 'live.hero.atDestinationIn', translateEs)).toBe('En destino en 10 min');
    expect(etaTag(1, 'live.hero.arrivesIn', translateEs)).toBe('Llegando');
    expect(liveEtaText(null, true, PASSENGER_KEYS)).toBeNull();
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
        PASSENGER_KEYS,
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
        PASSENGER_KEYS,
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
        PASSENGER_KEYS,
      ),
    ).toBe('En destino en 8 min');
  });
});
