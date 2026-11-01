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
});
