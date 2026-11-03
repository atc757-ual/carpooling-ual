import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ScreenWakeLockService } from './screen-wake-lock.service';

// Un WakeLockSentinel de mentira: se suelta con release() o cuando el
// navegador oculta la página (evento «release»)
function fakeSentinel(): WakeLockSentinel & { fireRelease: () => void } {
  const target = new EventTarget();
  return Object.assign(target, {
    released: false,
    type: 'screen' as const,
    onrelease: null,
    release: vi.fn().mockResolvedValue(undefined),
    fireRelease: () => target.dispatchEvent(new Event('release')),
  }) as unknown as WakeLockSentinel & { fireRelease: () => void };
}

describe('ScreenWakeLockService', () => {
  let request: ReturnType<typeof vi.fn>;
  let service: ScreenWakeLockService;

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  }

  beforeEach(() => {
    request = vi.fn().mockImplementation(() => Promise.resolve(fakeSentinel()));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    service = TestBed.inject(ScreenWakeLockService);
  });

  afterEach(async () => {
    await service.release();
    setVisibility('visible');
    Reflect.deleteProperty(navigator, 'wakeLock');
  });

  it('keeps the screen on once and lets it go', async () => {
    await service.keepOn();
    await service.keepOn();

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('screen');
    expect(service.isActive()).toBe(true);

    const sentinel = (await request.mock.results[0].value) as WakeLockSentinel;
    await service.release();
    expect(sentinel.release).toHaveBeenCalled();
    expect(service.isActive()).toBe(false);
  });

  it('asks again when the page is seen after the browser let it go', async () => {
    await service.keepOn();
    const sentinel = (await request.mock.results[0].value) as ReturnType<typeof fakeSentinel>;

    sentinel.fireRelease();
    expect(service.isActive()).toBe(false);
    setVisibility('visible');
    await vi.waitFor(() => expect(service.isActive()).toBe(true));

    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does nothing without the API and stays off when the browser says no', async () => {
    request.mockRejectedValue(new Error('low battery'));
    await service.keepOn();
    expect(service.isActive()).toBe(false);

    await service.release();
    Reflect.deleteProperty(navigator, 'wakeLock');
    await service.keepOn();
    expect(service.isActive()).toBe(false);
  });
});
