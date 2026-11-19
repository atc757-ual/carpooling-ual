import { pageTripEntries } from './trip-entries-page';

const at = (day: number): Date => new Date(Date.UTC(2026, 10, day, 8));

const KEYS = {
  driver: [
    { id: 'd-1', departureAt: at(3) },
    { id: 'd-2', departureAt: at(1) },
  ],
  passenger: [
    { id: 'p-1', departureAt: at(2) },
    { id: 'p-2', departureAt: at(4) },
  ],
};

describe('pageTripEntries', () => {
  it('mixes both profiles, the soonest first in «Próximos»', () => {
    const page = pageTripEntries(KEYS, {
      tab: 'upcoming',
      page: { offset: 0, limit: 10 },
    });

    expect(page.total).toBe(4);
    expect(page.items.map(({ role, id }) => `${role}:${id}`)).toEqual([
      'driver:d-2',
      'passenger:p-1',
      'driver:d-1',
      'passenger:p-2',
    ]);
  });

  it('puts the latest first in the other tabs and cuts the page', () => {
    const page = pageTripEntries(KEYS, {
      tab: 'past',
      page: { offset: 1, limit: 2 },
    });

    expect(page.total).toBe(4);
    expect(page.items.map(({ id }) => id)).toEqual(['d-1', 'p-1']);
  });

  it('breaks ties by id, so a page never repeats or skips a row', () => {
    const page = pageTripEntries(
      {
        driver: [{ id: 'b', departureAt: at(1) }],
        passenger: [{ id: 'a', departureAt: at(1) }],
      },
      { tab: 'upcoming', page: { offset: 0, limit: 10 } },
    );

    expect(page.items.map(({ id }) => id)).toEqual(['a', 'b']);
  });

  it('gives an empty page past the end', () => {
    expect(
      pageTripEntries(KEYS, {
        tab: 'cancelled',
        page: { offset: 10, limit: 10 },
      }),
    ).toEqual({ items: [], total: 4 });
  });
});
