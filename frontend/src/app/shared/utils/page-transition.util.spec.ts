import { TransitionOptions } from '@ionic/core/components';
import { vi } from 'vitest';
import { pageTransition } from './page-transition.util';

describe('pageTransition', () => {
  function options(): TransitionOptions {
    const enteringEl = document.createElement('div');
    enteringEl.classList.add('ion-page', 'ion-page-invisible');
    const leavingEl = document.createElement('div');
    leavingEl.classList.add('ion-page');
    return {
      enteringEl,
      leavingEl,
      baseEl: document.createElement('div'),
      direction: 'forward',
    } as unknown as TransitionOptions;
  }

  function stubDesktop(matches: boolean): void {
    vi.stubGlobal('matchMedia', () => ({ matches }));
  }

  afterEach(() => vi.unstubAllGlobals());

  it('changes page on desktop without moving it, like a website', () => {
    stubDesktop(true);
    const opts = options();

    const animation = pageTransition(false)(opts.baseEl, opts);

    expect(animation.elements).toEqual([opts.enteringEl]);
    expect(animation.getKeyframes()).toEqual([]);
  });

  it('shows the inner .ion-page when the entering element wraps it', () => {
    stubDesktop(true);
    const opts = options();
    const wrapper = document.createElement('app-page');
    wrapper.append(opts.enteringEl);

    const animation = pageTransition(false)(opts.baseEl, { ...opts, enteringEl: wrapper });

    expect(animation.elements).toEqual([opts.enteringEl]);
  });

  it('keeps the Android transition on a phone', () => {
    stubDesktop(false);
    const opts = options();

    const animation = pageTransition(false)(opts.baseEl, opts);

    // La de Android hace subir la pantalla que entra con un fundido
    expect(animation.getKeyframes().length).toBeGreaterThan(0);
  });

  it('keeps the iOS transition on an iPhone, also wide', () => {
    stubDesktop(true);
    const opts = options();

    const animation = pageTransition(true)(opts.baseEl, opts);

    expect(animation.childAnimations.length).toBeGreaterThan(0);
  });
});
