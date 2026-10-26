import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { vi } from 'vitest';
import { Profile } from '../models/user.model';
import { AuthService } from '../services/auth/auth.service';
import { leaveModesGuard } from './leave-modes.guard';

describe('leaveModesGuard', () => {
  let profiles: Profile[];
  let isLoggedIn: ReturnType<typeof signal<boolean>>;
  let logout: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    profiles = [];
    isLoggedIn = signal(true);
    logout = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { isLoggedIn, logout, hasProfile: (p: Profile) => profiles.includes(p) },
        },
      ],
    });
  });

  async function leaveTo(url: string): Promise<boolean | string> {
    const result = await TestBed.runInInjectionContext(() =>
      leaveModesGuard(
        {},
        {} as ActivatedRouteSnapshot,
        {} as RouterStateSnapshot,
        { url } as RouterStateSnapshot,
      ),
    );
    return result instanceof UrlTree
      ? TestBed.inject(Router).serializeUrl(result)
      : (result as boolean);
  }

  it('lets go once a mode is chosen, keeping the session', async () => {
    profiles = ['passenger'];

    expect(await leaveTo('/')).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });

  it('ends the session and goes to the welcome screen when leaving without a mode', async () => {
    expect(await leaveTo('/auth/verify')).toBe('/auth/welcome');
    expect(logout).toHaveBeenCalled();
  });

  it('lets go to the welcome screen after ending the session', async () => {
    expect(await leaveTo('/auth/welcome')).toBe(true);
    expect(logout).toHaveBeenCalled();
  });

  it('does nothing without a session', async () => {
    isLoggedIn.set(false);

    expect(await leaveTo('/auth/welcome')).toBe(true);
    expect(logout).not.toHaveBeenCalled();
  });
});
