import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';

export type AppLanguage = 'es' | 'en';
const LANGUAGE_STORAGE_KEY = 'carpooling_language';

// Servicio centralizado de idioma (español por defecto; inglés como alternativa).
// Persiste en localStorage y aplica el idioma en Transloco.
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);

  readonly currentLanguage = signal<AppLanguage>(this.detectInitialLanguage());

  constructor() {
    this.applyLanguage(this.currentLanguage());
  }

  setLanguage(lang: AppLanguage): void {
    if (this.currentLanguage() === lang) {
      return;
    }
    this.currentLanguage.set(lang);
    this.applyLanguage(lang);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch {
      // Ignorar si localStorage no está disponible
    }
  }

  toggleLanguage(): void {
    const next: AppLanguage = this.currentLanguage() === 'es' ? 'en' : 'es';
    this.setLanguage(next);
  }

  private detectInitialLanguage(): AppLanguage {
    try {
      const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (saved === 'es' || saved === 'en') {
        return saved;
      }
    } catch {
      // Continuar con idioma por defecto
    }

    return 'es';
  }

  private applyLanguage(lang: AppLanguage): void {
    this.transloco.setActiveLang(lang);
  }
}
