import { TestBed } from '@angular/core/testing';
import { CanActivateFn, provideRouter, UrlTree } from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/services/auth/auth.service';
import { LegalDocumentsService } from './core/services/users/legal-documents.service';

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
      ].sort(),
    );
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
          provideRouter([]),
          { provide: AuthService, useValue: { isLoggedIn: () => isLoggedIn } },
          {
            provide: LegalDocumentsService,
            useValue: {
              pending: throws
                ? vi.fn().mockRejectedValue(new Error('fail'))
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
});
