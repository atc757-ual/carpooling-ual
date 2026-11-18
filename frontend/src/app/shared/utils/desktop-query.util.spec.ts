import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { IonModal } from '@ionic/angular';
import { vi } from 'vitest';
import {
  fitLiveSheetBreakpoints,
  injectIsDesktop,
  injectIsOnUrl,
  injectLiveSheet,
  injectMatchesMedia,
  LIVE_SHEET_FULL_BREAKPOINT,
  liveSheetInset,
  WIDE_ASIDE_MEDIA_QUERY,
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

  it('follows any media query and stops listening when destroyed', () => {
    const removeEventListener = vi.fn();
    const matchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener,
    });
    vi.stubGlobal('matchMedia', matchMedia);
    const isWide = TestBed.runInInjectionContext(() => injectMatchesMedia(WIDE_ASIDE_MEDIA_QUERY));

    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
    expect(isWide()).toBe(true);
    TestBed.resetTestingModule();
    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });

  it('behaves as on a desktop when the browser has no matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const isWide = TestBed.runInInjectionContext(() => injectMatchesMedia(WIDE_ASIDE_MEDIA_QUERY));

    expect(isWide()).toBe(true);
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

  it('fits the top stop to the content, with the two-thirds stop only when there is room', () => {
    expect(fitLiveSheetBreakpoints(0.3)).toEqual([0.2, 0.45]);
    expect(fitLiveSheetBreakpoints(0.6)).toEqual([0.2, 0.45, 0.6]);
    expect(fitLiveSheetBreakpoints(0.85)).toEqual([0.2, 0.45, 0.68, 0.85]);
    expect(fitLiveSheetBreakpoints(1.4)).toEqual([0.2, 0.45, 0.68, LIVE_SHEET_FULL_BREAKPOINT]);
  });

  it('goes up one stop with «Ver más» and follows the content when it changes', async () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideRouter([{ path: 'tabs/trips/ride/:id', component: BlankPage }])],
    });
    await TestBed.inject(Router).navigateByUrl('/tabs/trips/ride/r1');
    const sheet = TestBed.runInInjectionContext(() => injectLiveSheet(/^\/tabs\/trips\/ride\//));
    const setCurrentBreakpoint = vi.fn().mockResolvedValue(undefined);
    sheet.setModal({ dismiss: vi.fn(), setCurrentBreakpoint } as unknown as IonModal);

    // De media pantalla a la siguiente parada
    sheet.expandStep();
    expect(setCurrentBreakpoint).toHaveBeenLastCalledWith(0.68);

    // El contenido crece hasta el 85 %: la parada de arriba lo sigue, sin mover la hoja
    sheet.fitToContent(0.85);
    expect(sheet.breakpoints).toEqual([0.2, 0.45, 0.68, 0.85]);
    expect(setCurrentBreakpoint).toHaveBeenCalledTimes(1);

    // Con la hoja arriba, si el contenido encoge, baja con él
    sheet.breakpoint.set(0.85);
    sheet.fitToContent(0.6);
    expect(sheet.breakpoints).toEqual([0.2, 0.45, 0.6]);
    expect(setCurrentBreakpoint).toHaveBeenLastCalledWith(0.6);

    // Sin cambios, no hace nada; y en la parada de arriba, «Ver más» no sube más
    sheet.fitToContent(0.6);
    sheet.breakpoint.set(0.6);
    sheet.expandStep();
    expect(setCurrentBreakpoint).toHaveBeenCalledTimes(2);
  });
});
