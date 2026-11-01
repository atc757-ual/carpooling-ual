import { TestBed } from '@angular/core/testing';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth/auth.service';

describe('application routes', () => {
  it('opens Search with a passenger profile, and Publish for a driver only', () => {
    const tabsRoute = routes.find(({ path }) => path === 'tabs');
    const redirectTo = tabsRoute?.children?.find(({ path }) => path === '')?.redirectTo;
    const landingFor = (isPassenger: boolean): unknown => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [{ provide: AuthService, useValue: { hasProfile: () => isPassenger } }],
      });
      return TestBed.runInInjectionContext(() =>
        typeof redirectTo === 'function' ? redirectTo({} as never) : redirectTo,
      );
    };

    expect(landingFor(true)).toBe('/tabs/search');
    expect(landingFor(false)).toBe('/tabs/publish');
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
