import { DestroyRef } from '@angular/core';
import { vi } from 'vitest';
import { createCountdown, getResendLabel } from './countdown.util';

// DestroyRef de mentira: guarda la función para «destruir la pantalla»
function fakeDestroyRef(): { ref: DestroyRef; destroy: () => void } {
  let onDestroy = (): void => undefined;
  const ref = {
    onDestroy: (callback: () => void) => {
      onDestroy = callback;
      return () => undefined;
    },
  } as unknown as DestroyRef;
  return { ref, destroy: () => onDestroy() };
}

describe('createCountdown', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('counts down one second at a time and stops at 0', () => {
    const countdown = createCountdown(3, fakeDestroyRef().ref);

    countdown.restart();
    vi.advanceTimersByTime(1000);
    expect(countdown.seconds()).toBe(2);

    vi.advanceTimersByTime(5000);
    expect(countdown.seconds()).toBe(0);
  });

  it('starts again from the beginning', () => {
    const countdown = createCountdown(3, fakeDestroyRef().ref);
    countdown.restart();
    vi.advanceTimersByTime(2000);

    countdown.restart();

    expect(countdown.seconds()).toBe(3);
    vi.advanceTimersByTime(1000);
    expect(countdown.seconds()).toBe(2);
  });

  it('stops when the screen is destroyed', () => {
    const { ref, destroy } = fakeDestroyRef();
    const countdown = createCountdown(3, ref);
    countdown.restart();

    destroy();
    vi.advanceTimersByTime(3000);

    expect(countdown.seconds()).toBe(3);
  });
});

describe('getResendLabel', () => {
  it('shows the time left, or that the code can be resent', () => {
    expect(getResendLabel(60)).toBe('Reenviar código en 01:00');
    expect(getResendLabel(42)).toBe('Reenviar código en 00:42');
    expect(getResendLabel(5)).toBe('Reenviar código en 00:05');
    expect(getResendLabel(0)).toBe('Reenviar código');
  });
});
