import { getMatchFit, MATCH_FIT_LABELS } from './match-fit';

const SEARCH = { direction: 'to-campus' as const, time: '08:00', margin: 30 };

describe('getMatchFit', () => {
  it('fits well near the asked time with a small detour', () => {
    expect(
      getMatchFit({ arrivalTime: '08:05', departureTime: '07:30', pickupDetourMinutes: 3 }, SEARCH),
    ).toBe('good');
  });

  it('fits fairly in the middle of the margin or with a medium detour', () => {
    expect(
      getMatchFit({ arrivalTime: '08:15', departureTime: '07:40', pickupDetourMinutes: 3 }, SEARCH),
    ).toBe('fair');
    expect(
      getMatchFit({ arrivalTime: '08:00', departureTime: '07:30', pickupDetourMinutes: 8 }, SEARCH),
    ).toBe('fair');
  });

  it('fits tight near the edge of the margin or with a large detour', () => {
    expect(
      getMatchFit({ arrivalTime: '08:25', departureTime: '07:50', pickupDetourMinutes: 0 }, SEARCH),
    ).toBe('tight');
    expect(
      getMatchFit(
        { arrivalTime: '08:00', departureTime: '07:30', pickupDetourMinutes: 12 },
        SEARCH,
      ),
    ).toBe('tight');
  });

  it('compares the departure when coming back from the campus, and a margin of 0', () => {
    const back = { direction: 'from-campus' as const, time: '14:00', margin: 0 };
    expect(
      getMatchFit({ arrivalTime: '14:40', departureTime: '14:00', pickupDetourMinutes: 2 }, back),
    ).toBe('good');
    expect(MATCH_FIT_LABELS.tight).toBe('Encaja justo');
  });
});
