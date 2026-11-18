import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { RevealOnTouch, revealedHint } from './reveal-on-touch.directive';

@Component({
  imports: [RevealOnTouch],
  template: `
    <button
      type="button"
      class="share"
      appRevealOnTouch
      appRevealHint="Comparte tu viaje."
      (click)="shares = shares + 1"
    >
      Compartir
    </button>
    <button type="button" class="sos" appRevealOnTouch (click)="calls = calls + 1">SOS</button>
  `,
})
class HostComponent {
  shares = 0;
  calls = 0;
}

// jsdom no tiene PointerEvent: un MouseEvent con pointerType
function tap(element: HTMLElement, pointerType: string): void {
  const down = new MouseEvent('pointerdown', { bubbles: true });
  Object.assign(down, { pointerType });
  element.dispatchEvent(down);
  element.click();
}

describe('RevealOnTouch', () => {
  let root: HTMLElement;
  let host: HostComponent;
  let share: HTMLElement;
  let sos: HTMLElement;
  let detect: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    detect = () => fixture.detectChanges();
    host = fixture.componentInstance;
    root = fixture.nativeElement as HTMLElement;
    share = root.querySelector('.share') as HTMLElement;
    sos = root.querySelector('.sos') as HTMLElement;
  });

  afterEach(() => vi.useRealTimers());

  it('with a finger, the first tap only unfolds the button and tells what it does', () => {
    tap(share, 'touch');
    detect();
    expect(host.shares).toBe(0);
    expect(share.classList).toContain('icon-btn--revealed');
    expect(revealedHint()).toBe('Comparte tu viaje.');

    tap(share, 'touch');
    detect();
    expect(host.shares).toBe(1);
    expect(share.classList).not.toContain('icon-btn--revealed');
    expect(revealedHint()).toBeNull();
  });

  it('keeps one button unfolded at a time and folds it back after a while', () => {
    tap(share, 'touch');
    tap(sos, 'touch');
    detect();
    expect(share.classList).not.toContain('icon-btn--revealed');
    expect(sos.classList).toContain('icon-btn--revealed');
    expect(revealedHint()).toBeNull();

    vi.advanceTimersByTime(4000);
    detect();
    expect(sos.classList).not.toContain('icon-btn--revealed');
  });

  it('with the mouse or the keyboard, acts on the first click', () => {
    tap(share, 'mouse');
    sos.click();
    expect(host.shares).toBe(1);
    expect(host.calls).toBe(1);
  });
});
