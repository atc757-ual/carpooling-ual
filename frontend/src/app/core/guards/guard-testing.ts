import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Profile } from '../models/user.model';
import { AuthService } from '../services/auth/auth.service';

// Ayuda para los tests de los guards: una sesión simulada y la ejecución del
// guard, que devuelve true o la URL a la que redirige
export function setUpGuardTest(): {
  logIn: (...profiles: Profile[]) => void;
  run: (guard: CanActivateFn, url?: string) => boolean | string;
} {
  const isLoggedIn = signal(false);
  let profiles: Profile[] = [];

  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: { isLoggedIn, hasProfile: (profile: Profile) => profiles.includes(profile) } },
    ],
  });

  return {
    logIn: (...userProfiles) => {
      isLoggedIn.set(true);
      profiles = userProfiles;
    },
    run: (guard, url = '/trips/new') => {
      const state = { url } as RouterStateSnapshot;
      const result = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, state));
      return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : (result as boolean);
    },
  };
}
