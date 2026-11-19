import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { vi } from 'vitest';
import { NavigationHistoryService } from './navigation-history.service';

@Component({ template: '' })
class EmptyPage {}

describe('NavigationHistoryService', () => {
  let router: Router;
  let location: Location;
  let history: NavigationHistoryService;
  let navigateBack: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    navigateBack = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: EmptyPage }]),
        provideLocationMocks(),
        { provide: NavController, useValue: { navigateBack } },
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    history = TestBed.inject(NavigationHistoryService);
  });

  // Lo que tarda el router en atender el botón atrás
  const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  // La app se abre en esa dirección (su primera pantalla)
  async function openApp(url: string): Promise<void> {
    location.replaceState(url);
    router.initialNavigation();
    await settle();
  }

  async function goBack(fallbackUrl: string): Promise<void> {
    history.back(fallbackUrl);
    await settle();
  }

  it('goes to the fallback when the app was opened on that screen', async () => {
    await openApp('/tabs/trips/published/t1');

    expect(history.canGoBack).toBe(false);
    await goBack('/tabs/trips');

    expect(navigateBack).toHaveBeenCalledWith('/tabs/trips');
    expect(location.path()).toBe('/tabs/trips/published/t1');
  });

  it('goes back to the previous screen, also from another tab', async () => {
    await openApp('/tabs/search');
    await router.navigateByUrl('/tabs/trips/published/t1');

    expect(history.canGoBack).toBe(true);
    await goBack('/tabs/trips');

    expect(location.path()).toBe('/tabs/search');
    expect(navigateBack).not.toHaveBeenCalled();
    expect(history.canGoBack).toBe(false);
  });

  it('does not count a screen that replaced the previous one (a push)', async () => {
    await openApp('/tabs/push-open?type=trip.published&tripId=t1');
    await router.navigateByUrl('/tabs/trips/published/t1', { replaceUrl: true });

    expect(history.canGoBack).toBe(false);
    await goBack('/tabs/trips');

    expect(navigateBack).toHaveBeenCalledWith('/tabs/trips');
  });

  it('goes back step by step and then to the fallback', async () => {
    await openApp('/tabs/search');
    await router.navigateByUrl('/tabs/search/results');
    await router.navigateByUrl('/tabs/search/trips/t1');

    await goBack('/tabs/search/results');
    expect(location.path()).toBe('/tabs/search/results');
    await goBack('/tabs/search');
    expect(location.path()).toBe('/tabs/search');

    await goBack('/tabs/search');
    expect(navigateBack).toHaveBeenCalledWith('/tabs/search');
  });
});
