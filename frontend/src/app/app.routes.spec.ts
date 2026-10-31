import { routes } from './app.routes';

describe('application routes', () => {
  it('opens Publish by default for every signed-in profile', () => {
    const tabsRoute = routes.find(({ path }) => path === 'tabs');
    const defaultTabRoute = tabsRoute?.children?.find(({ path }) => path === '');

    expect(defaultTabRoute?.redirectTo).toBe('publish');
  });
});
