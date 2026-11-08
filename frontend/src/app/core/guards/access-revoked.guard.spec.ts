import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CanActivateFn, provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth/auth.service';
import { accessRevokedGuard, accessRevokedOnlyGuard } from './access-revoked.guard';

describe('access revoked guards', () => {
  const currentUser = signal<{ isAccessRevoked?: boolean } | null>(null);

  function run(guard: CanActivateFn): boolean | string {
    const result = TestBed.runInInjectionContext(() => guard(null as never, null as never));
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: { currentUser } }],
    });
  });

  it('sends an account with its profiles revoked to the explanation', () => {
    currentUser.set({ isAccessRevoked: true });
    expect(run(accessRevokedGuard)).toBe('/account-disabled');
    expect(run(accessRevokedOnlyGuard)).toBe(true);
  });

  it('lets any other account in, and keeps it out of the explanation', () => {
    currentUser.set({ isAccessRevoked: false });
    expect(run(accessRevokedGuard)).toBe(true);
    expect(run(accessRevokedOnlyGuard)).toBe('/tabs');

    currentUser.set({});
    expect(run(accessRevokedGuard)).toBe(true);
    expect(run(accessRevokedOnlyGuard)).toBe('/tabs');
  });
});
