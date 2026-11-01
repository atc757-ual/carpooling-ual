import { appAreaGuard } from './app-area.guard';
import { setUpGuardTest } from './guard-testing';

describe('appAreaGuard', () => {
  it('sends an admin without other profiles to the panel', () => {
    const { logIn, run } = setUpGuardTest();
    logIn('admin');

    expect(run(appAreaGuard, '/tabs/publish')).toBe('/admin');
  });

  it('lets drivers, passengers and admins who also travel into the app', () => {
    const { logIn, run } = setUpGuardTest();
    logIn('driver', 'admin');
    expect(run(appAreaGuard, '/tabs/publish')).toBe(true);

    logIn('passenger');
    expect(run(appAreaGuard, '/tabs/search')).toBe(true);
  });
});
