import { provideAppTransloco } from './core/i18n/testing-transloco';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, provideRouter, Route, UrlTree } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth/auth.service';
import { LegalDocumentsService } from './core/services/users/legal-documents.service';
import { ApiError, NETWORK_ERROR } from './core/models/api-error.model';

function collectLazyLoaders(routeList: readonly Route[]): (() => unknown)[] {
  const loaders: (() => unknown)[] = [];
  for (const route of routeList) {
    if (route.loadComponent) {
      loaders.push(route.loadComponent);
    }
    if (route.children) {
      loaders.push(...collectLazyLoaders(route.children));
    }
  }
  return loaders;
}

describe('application routes', () => {
  it('opens Search with a passenger profile, and Publish for a driver only', () => {
    const tabsRoute = routes.find(({ path }) => path === 'tabs');
    const redirectTo = tabsRoute?.children?.find(({ path }) => path === '')?.redirectTo;
    const landingFor = (isPassenger: boolean): unknown => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideAppTransloco(),
          { provide: AuthService, useValue: { hasProfile: () => isPassenger } },
        ],
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
    // Usuarios, Incidencias y Viajes ya tienen pantalla, con su detalle; el
    // resto, su marcador
    expect(sections.map(({ path }) => path).sort()).toEqual(
      [
        'simulation',
        'digital-twin',
        'users',
        'users/:id',
        'incidents',
        'incidents/:id',
        'trips',
        'trips/:id',
        'catalogs',
        'settings',
      ].sort(),
    );
  });

  it('allows access to account-created only when logged in', () => {
    const accountCreatedRoute = routes.find(({ path }) => path === 'account-created');
    const guard = accountCreatedRoute?.canActivate?.[0] as CanActivateFn;
    const runGuard = (isLoggedIn: boolean): unknown => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideAppTransloco(),
          provideRouter([]),
          { provide: AuthService, useValue: { isLoggedIn: () => isLoggedIn } },
        ],
      });
      return TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    };

    expect(runGuard(true)).toBe(true);
    expect((runGuard(false) as UrlTree).toString()).toBe('/auth/welcome');
  });

  it('allows access to legal-update only when logged in with pending documents', async () => {
    const legalRoute = routes.find(({ path }) => path === 'legal-update');
    const guard = legalRoute?.canActivate?.[0] as CanActivateFn;
    const runGuard = async (
      isLoggedIn: boolean,
      pending: unknown[] = [],
      throws = false,
    ): Promise<unknown> => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideAppTransloco(),
          provideRouter([]),
          { provide: AuthService, useValue: { isLoggedIn: () => isLoggedIn } },
          {
            provide: LegalDocumentsService,
            useValue: {
              pending: throws
                ? vi.fn().mockRejectedValue(new ApiError(NETWORK_ERROR, 0))
                : vi.fn().mockResolvedValue(pending),
            },
          },
        ],
      });
      return TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    };

    // Not logged in -> redirect to /auth/welcome
    const notLoggedIn = await runGuard(false);
    expect((notLoggedIn as UrlTree).toString()).toBe('/auth/welcome');

    // Logged in with pending docs -> true
    expect(await runGuard(true, [{ type: 'terms', version: '1.1' }])).toBe(true);

    // Logged in with no pending docs -> redirect to /tabs
    const noPending = await runGuard(true, []);
    expect((noPending as UrlTree).toString()).toBe('/tabs');

    // Error -> stays, the page offers a retry
    expect(await runGuard(true, [], true)).toBe(true);
  });

  it('loads the profile subpages for preferences and settings', async () => {
    const tabsRoute = routes.find(({ path }) => path === 'tabs');
    const prefsRoute = tabsRoute?.children?.find(({ path }) => path === 'profile/preferences');
    const settingsRoute = tabsRoute?.children?.find(({ path }) => path === 'profile/settings');

    expect(await prefsRoute?.loadComponent?.()).toBeDefined();
    expect(await settingsRoute?.loadComponent?.()).toBeDefined();
  });

  it('resolves all lazy loadComponent callbacks across app and admin routes', async () => {
    const loaders = collectLazyLoaders(routes);
    expect(loaders.length).toBeGreaterThan(25);
    const loaded = await Promise.all(loaders.map((load) => load()));
    for (const component of loaded) {
      expect(component).toBeDefined();
    }
  }, 30_000);
});
