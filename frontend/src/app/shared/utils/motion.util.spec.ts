import { vi } from 'vitest';
import { prefersReducedMotion, scrollBehavior } from './motion.util';

describe('motion.util', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubReducedMotion(matches: boolean): void {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches, media: query }));
  }

  it('scrolls smoothly unless the system asks to reduce motion', () => {
    stubReducedMotion(false);
    expect(prefersReducedMotion()).toBe(false);
    expect(scrollBehavior()).toBe('smooth');

    stubReducedMotion(true);
    expect(prefersReducedMotion()).toBe(true);
    expect(scrollBehavior()).toBe('auto');
  });

  it('scrolls smoothly without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(scrollBehavior()).toBe('smooth');
  });
});
