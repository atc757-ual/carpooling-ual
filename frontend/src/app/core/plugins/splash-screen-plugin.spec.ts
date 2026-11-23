import { TestBed } from '@angular/core/testing';
import { Event, NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Subject } from 'rxjs';
import { MockInstance, vi } from 'vitest';
import { SPLASH_MAX_WAIT_MS, SplashScreenPlugin } from './splash-screen-plugin';

describe('SplashScreenPlugin', () => {
  let events: Subject<Event>;
  let hide: MockInstance<() => Promise<void>>;

  function start(isNative: boolean): void {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(isNative);
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { events } }],
    });
    const splash = TestBed.inject(SplashScreenPlugin);
    hide = vi.spyOn(splash, 'hide').mockResolvedValue(undefined);
    splash.hideWhenReady();
  }

  beforeEach(() => {
    events = new Subject<Event>();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('hides the splash once the first screen is shown, only once', () => {
    start(true);

    events.next(new NavigationStart(1, '/'));
    expect(hide).not.toHaveBeenCalled();

    events.next(new NavigationEnd(1, '/', '/tabs/search'));
    events.next(new NavigationEnd(2, '/tabs/trips', '/tabs/trips'));
    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('hides it anyway when the first screen does not arrive', () => {
    vi.useFakeTimers();
    start(true);

    vi.advanceTimersByTime(SPLASH_MAX_WAIT_MS);

    expect(hide).toHaveBeenCalledTimes(1);
  });

  it('does nothing on the web', () => {
    start(false);

    events.next(new NavigationEnd(1, '/', '/tabs/search'));

    expect(hide).not.toHaveBeenCalled();
  });
});
