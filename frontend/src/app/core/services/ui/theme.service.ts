import { DOCUMENT, inject, Injectable, signal } from '@angular/core';
import { PreferencesPlugin } from '../../plugins/preferences-plugin';

const THEME_KEY = 'theme';
const DARK_CLASS = 'theme-dark';
const LIGHT_CLASS = 'theme-light';

// Modo claro u oscuro elegido en Perfil. Sin elección, sigue al sistema; al
// elegir, fuerza el modo con una clase en <html> (ver theme/_color-scheme.scss)
// y lo recuerda para la próxima vez
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly preferences = inject(PreferencesPlugin);

  readonly isDark = signal(this.prefersDark());

  constructor() {
    this.listenToSystemChanges();
  }

  async restore(): Promise<void> {
    const saved = await this.preferences.get(THEME_KEY);
    if (saved === 'dark' || saved === 'light') {
      this.apply(saved === 'dark');
    }
  }

  async set(isDark: boolean): Promise<void> {
    this.apply(isDark);
    await this.preferences.set(THEME_KEY, isDark ? 'dark' : 'light');
  }

  async toggle(): Promise<void> {
    const isDark = !this.isDark();
    await this.set(isDark);
  }

  private apply(isDark: boolean): void {
    const root = this.document.documentElement.classList;
    root.toggle(DARK_CLASS, isDark);
    root.toggle(LIGHT_CLASS, !isDark);
    this.isDark.set(isDark);
  }

  private prefersDark(): boolean {
    return this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }

  private listenToSystemChanges(): void {
    const media = this.document.defaultView?.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', async (event) => {
      const saved = await this.preferences.get(THEME_KEY);
      if (!saved) {
        this.isDark.set(event.matches);
      }
    });
  }
}
