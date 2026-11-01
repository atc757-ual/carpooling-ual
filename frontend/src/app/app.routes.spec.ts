import { routes } from './app.routes';

describe('application routes', () => {
  it('opens Publish by default for every signed-in profile', () => {
    const tabsRoute = routes.find(({ path }) => path === 'tabs');
    const defaultTabRoute = tabsRoute?.children?.find(({ path }) => path === '');

    expect(defaultTabRoute?.redirectTo).toBe('publish');
  });

  it('opens the admin panel on the simulation and has one route per section', () => {
    const adminRoute = routes.find(({ path }) => path === 'admin');
    const [entry, ...sections] = adminRoute?.children ?? [];

    expect(entry.redirectTo).toBe('simulation');
    expect(sections.map(({ path }) => path)).toEqual([
      'simulation',
      'digital-twin',
      'users',
      'incidents',
      'trips',
      'catalogs',
    ]);
  });
});
