import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { LegalDocumentsService } from '../services/users/legal-documents.service';
import { legalAcceptanceGuard } from './legal-acceptance.guard';

describe('legalAcceptanceGuard', () => {
  const isLoggedIn = signal(true);
  const pending = vi.fn();

  beforeEach(() => {
    isLoggedIn.set(true);
    pending.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isLoggedIn } },
        { provide: LegalDocumentsService, useValue: { pending } },
      ],
    });
  });

  async function run(url = '/tabs/search'): Promise<boolean | string> {
    const result = await TestBed.runInInjectionContext(() =>
      legalAcceptanceGuard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  it('lets in whoever has accepted the current documents', async () => {
    pending.mockResolvedValue([]);
    await expect(run()).resolves.toBe(true);
  });

  it('asks to accept a new version first, remembering the page', async () => {
    pending.mockResolvedValue([{ type: 'terms', version: '1.1' }]);
    await expect(run('/tabs/trips')).resolves.toBe('/legal-update?returnUrl=%2Ftabs%2Ftrips');
  });

  it('leaves guests to the auth guard and does not block without connection', async () => {
    isLoggedIn.set(false);
    await expect(run()).resolves.toBe(true);
    expect(pending).not.toHaveBeenCalled();

    isLoggedIn.set(true);
    pending.mockRejectedValue(new Error('offline'));
    await expect(run()).resolves.toBe(true);
  });
});
