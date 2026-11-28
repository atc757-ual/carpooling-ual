import { DestroyRef, ElementRef, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { IonTabs } from '@ionic/angular';
import { Subject } from 'rxjs';
import { vi } from 'vitest';
import { keepChromeInActivePage } from './tabs-chrome';

describe('keepChromeInActivePage', () => {
  // Una pantalla de Ionic con (o aún sin) su ion-content
  function page(withContent = true): HTMLElement {
    const element = document.createElement('app-page');
    if (withContent) element.append(document.createElement('ion-content'));
    return element;
  }

  function setUp(active?: HTMLElement) {
    const host = document.createElement('div');
    const chrome = document.createElement('div');
    const tabsElement = document.createElement('ion-tabs');
    host.append(chrome, tabsElement);
    if (active) tabsElement.append(active);
    const stackWillChange = new Subject<{ enteringView: { element: HTMLElement } }>();
    const outlet = {
      stackWillChange,
      activatedComponentRef: active ? { location: { nativeElement: active } } : null,
    };
    TestBed.runInInjectionContext(() =>
      keepChromeInActivePage({
        chrome: signal(new ElementRef(chrome)),
        tabs: signal({ outlet } as unknown as IonTabs),
        tabsElement: signal(new ElementRef(tabsElement)),
        destroyRef: TestBed.inject(DestroyRef),
      }),
    );
    TestBed.tick();
    return { chrome, tabsElement, stackWillChange };
  }

  const contentOf = (element: HTMLElement) => element.querySelector('ion-content');

  it('puts the menu and the strip at the start of the active page content', () => {
    const active = page();
    const { chrome } = setUp(active);

    expect(contentOf(active)?.firstElementChild).toBe(chrome);
  });

  it('moves them to the page that is about to enter, before the old one goes', () => {
    const { chrome, stackWillChange } = setUp(page());
    const entering = page();

    stackWillChange.next({ enteringView: { element: entering } });

    expect(contentOf(entering)?.firstElementChild).toBe(chrome);
  });

  it('keeps them before the tabs until the entering page paints its content', () => {
    vi.useFakeTimers();
    const { chrome, tabsElement, stackWillChange } = setUp();
    expect(chrome.nextElementSibling).toBe(tabsElement);
    const entering = page(false);

    stackWillChange.next({ enteringView: { element: entering } });
    expect(chrome.nextElementSibling).toBe(tabsElement);

    entering.append(document.createElement('ion-content'));
    vi.advanceTimersToNextFrame();
    expect(contentOf(entering)?.firstElementChild).toBe(chrome);
    vi.useRealTimers();
  });
});
