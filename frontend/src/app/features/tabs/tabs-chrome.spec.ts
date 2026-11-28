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
    const stackDidChange = new Subject<void>();
    const outlet = {
      stackWillChange,
      stackDidChange,
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
    return { chrome, tabsElement, stackWillChange, stackDidChange };
  }

  const contentOf = (element: HTMLElement) => element.querySelector('ion-content');

  it('puts the menu and the strip at the start of the active page content', () => {
    const active = page();
    const { chrome } = setUp(active);

    expect(contentOf(active)?.firstElementChild).toBe(chrome);
  });

  it('moves them to the entering page and leaves a still copy in the leaving one', () => {
    const leaving = page();
    const { chrome, stackWillChange } = setUp(leaving);
    chrome.innerHTML = '<h1 id="title">Mi perfil</h1>';
    const entering = page();

    stackWillChange.next({ enteringView: { element: entering } });

    expect(contentOf(entering)?.firstElementChild).toBe(chrome);
    // La copia se ve igual mientras sale, pero no se lee ni se pulsa
    const snapshot = contentOf(leaving)?.firstElementChild as HTMLElement;
    expect(snapshot.classList).toContain('tabs-chrome--snapshot');
    expect(snapshot.getAttribute('aria-hidden')).toBe('true');
    expect(snapshot.inert).toBe(true);
    expect(snapshot.textContent).toBe('Mi perfil');
    expect(snapshot.querySelector('[id]')).toBeNull();

    // Al volver, el menú reemplaza a la copia
    stackWillChange.next({ enteringView: { element: leaving } });
    expect(contentOf(leaving)?.querySelectorAll('.tabs-chrome--snapshot')).toHaveLength(0);
    expect(contentOf(leaving)?.firstElementChild).toBe(chrome);
  });

  it('removes the copy once the animation is over', () => {
    const leaving = page();
    const { tabsElement, stackWillChange, stackDidChange } = setUp(leaving);
    const entering = page();
    tabsElement.append(entering);

    stackWillChange.next({ enteringView: { element: entering } });
    expect(tabsElement.querySelectorAll('.tabs-chrome--snapshot')).toHaveLength(1);

    stackDidChange.next();
    expect(tabsElement.querySelectorAll('.tabs-chrome--snapshot')).toHaveLength(0);
  });

  it('waits for the entering page to paint its content without moving them', () => {
    vi.useFakeTimers();
    const leaving = page();
    const { chrome, stackWillChange } = setUp(leaving);
    const entering = page(false);

    stackWillChange.next({ enteringView: { element: entering } });
    expect(contentOf(leaving)?.firstElementChild).toBe(chrome);

    entering.append(document.createElement('ion-content'));
    vi.advanceTimersToNextFrame();
    expect(contentOf(entering)?.firstElementChild).toBe(chrome);
    vi.useRealTimers();
  });

  it('keeps them before the tabs when there is no page to hold them', () => {
    const { chrome, tabsElement } = setUp();

    expect(chrome.nextElementSibling).toBe(tabsElement);
  });
});
