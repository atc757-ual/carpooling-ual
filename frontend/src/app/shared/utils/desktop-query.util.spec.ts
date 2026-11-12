import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { IonModal } from '@ionic/angular';
import { vi } from 'vitest';
import {
  injectIsDesktop,
  injectIsOnUrl,
  injectLiveSheet,
  LIVE_SHEET_FULL_BREAKPOINT,
  liveSheetInset,
} from './desktop-query.util';

@Component({ template: '' })
class BlankPage {}

describe('desktop query', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('follows the width of the screen', () => {
    const media: { listener?: (event: MediaQueryListEvent) => void } = {};
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: (_: string, handler: (event: MediaQueryListEvent) => void) =>
          (media.listener = handler),
        removeEventListener: vi.fn(),
      }),
    );
    const isDesktop = TestBed.runInInjectionContext(() => injectIsDesktop());

    expect(isDesktop()).toBe(false);
    media.listener?.({ matches: true } as MediaQueryListEvent);
    expect(isDesktop()).toBe(true);
  });

  it('knows whether the URL is the one of the screen, from the start of a navigation', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'tabs/trips/ride/:id', component: BlankPage },
          { path: 'tabs/trips', component: BlankPage },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/tabs/trips/ride/r1');
    const isOn = TestBed.runInInjectionContext(() => injectIsOnUrl(/^\/tabs\/trips\/ride\//));

    expect(isOn()).toBe(true);
    await router.navigateByUrl('/tabs/trips');
    expect(isOn()).toBe(false);
  });

  it('measures what the sheet covers', () => {
    expect(liveSheetInset(0.5)).toBe(Math.round(window.innerHeight * 0.5));
  });

  it('controls the mobile live sheet lifecycle, expansion and dismissal', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'tabs/trips/ride/:id', component: BlankPage },
          { path: 'tabs/trips', component: BlankPage },
        ]),
      ],
    });
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/tabs/trips/ride/r1');
    const sheet = TestBed.runInInjectionContext(() => injectLiveSheet(/^\/tabs\/trips\/ride\//));
    const dismiss = vi.fn().mockResolvedValue(true);
    const setCurrentBreakpoint = vi.fn().mockResolvedValue(undefined);
    const modal = { dismiss, setCurrentBreakpoint } as unknown as IonModal;

    expect(sheet.isOpen()).toBe(true);
    expect(await sheet.canDismiss()).toBe(false);

    sheet.expand();
    sheet.setModal(modal);
    expect(setCurrentBreakpoint).toHaveBeenCalledWith(LIVE_SHEET_FULL_BREAKPOINT);

    await sheet.close();
    expect(dismiss).toHaveBeenCalled();
    expect(await sheet.canDismiss()).toBe(true);

    sheet.enter();
    expect(await sheet.canDismiss()).toBe(false);

    await router.navigateByUrl('/tabs/trips');
    TestBed.tick();
    expect(sheet.isOpen()).toBe(false);
  });
});
