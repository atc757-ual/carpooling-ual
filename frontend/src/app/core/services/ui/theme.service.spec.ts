import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  let saved: string | null;
  let preferences: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> };
  let root: DOMTokenList;

  function createService(): ThemeService {
    TestBed.configureTestingModule({
      providers: [{ provide: PreferencesPlugin, useValue: preferences }],
    });
    root = TestBed.inject(DOCUMENT).documentElement.classList;
    return TestBed.inject(ThemeService);
  }

  beforeEach(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light');
    saved = null;
    preferences = {
      get: vi.fn().mockImplementation(async () => saved),
      set: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    document.documentElement.classList.remove('theme-dark', 'theme-light');
  });

  it('follows the system until the user chooses a mode', async () => {
    const theme = createService();
    await theme.restore();

    expect(root.contains('theme-dark')).toBe(false);
    expect(root.contains('theme-light')).toBe(false);
  });

  it('restores the mode the user chose last time', async () => {
    saved = 'dark';
    const theme = createService();
    await theme.restore();

    expect(theme.isDark()).toBe(true);
    expect(root.contains('theme-dark')).toBe(true);
  });

  it('switches the mode, forces it on the page and remembers it', async () => {
    const theme = createService();
    const wasDark = theme.isDark();
    await theme.toggle();

    expect(theme.isDark()).toBe(!wasDark);
    expect(root.contains(wasDark ? 'theme-light' : 'theme-dark')).toBe(true);
    expect(preferences.set).toHaveBeenCalledWith('theme', wasDark ? 'light' : 'dark');
  });

  it('sets the mode explicitly, forces it on the page and remembers it', async () => {
    const theme = createService();
    await theme.set(true);

    expect(theme.isDark()).toBe(true);
    expect(root.contains('theme-dark')).toBe(true);
    expect(root.contains('theme-light')).toBe(false);
    expect(preferences.set).toHaveBeenCalledWith('theme', 'dark');

    await theme.set(false);
    expect(theme.isDark()).toBe(false);
    expect(root.contains('theme-light')).toBe(true);
    expect(root.contains('theme-dark')).toBe(false);
    expect(preferences.set).toHaveBeenCalledWith('theme', 'light');
  });

  it('updates dark signal when system theme changes and no preference is saved', async () => {
    let listener: ((e: MediaQueryListEvent) => void) | undefined;
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn((_type: string, cb: unknown) => {
        listener = cb as (e: MediaQueryListEvent) => void;
      }),
      removeEventListener: vi.fn(),
    } as unknown as MediaQueryList);

    const theme = createService();
    expect(theme.isDark()).toBe(false);

    listener?.({ matches: true } as MediaQueryListEvent);
    await Promise.resolve();
    expect(theme.isDark()).toBe(true);

    window.matchMedia = originalMatchMedia;
  });
});
