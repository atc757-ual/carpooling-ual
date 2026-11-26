import { setAppLocale } from '../../i18n/app-locale';
import { TestBed } from '@angular/core/testing';
import { provideTestingTransloco } from '../../i18n/testing-transloco';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  const originalLanguage = navigator.language;

  afterEach(() => {
    setAppLocale('es');
    localStorage.clear();
    Object.defineProperty(navigator, 'language', {
      value: originalLanguage,
      configurable: true,
    });
  });

  function setupModule(): void {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTestingTransloco(),
        { provide: LanguageService, useClass: LanguageService },
      ],
    });
  }

  it('initializes with saved language from localStorage if present', () => {
    setupModule();
    localStorage.setItem('carpooling_language', 'es');
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
    const service = TestBed.inject(LanguageService);
    expect(service.currentLanguage()).toBe('es');
  });

  it('detects English when navigator language starts with en and no saved language', () => {
    setupModule();
    localStorage.clear();
    Object.defineProperty(navigator, 'language', {
      value: 'en-US',
      configurable: true,
    });
    const service = TestBed.inject(LanguageService);
    expect(service.currentLanguage()).toBe('en');
  });

  it('defaults to Spanish when navigator language is Spanish or other', () => {
    setupModule();
    localStorage.clear();
    Object.defineProperty(navigator, 'language', {
      value: 'es-ES',
      configurable: true,
    });
    const service = TestBed.inject(LanguageService);
    expect(service.currentLanguage()).toBe('es');
  });

  it('persists selected language to localStorage and updates state', () => {
    setupModule();
    const service = TestBed.inject(LanguageService);
    service.setLanguage('es');
    service.setLanguage('en');
    expect(service.currentLanguage()).toBe('en');
    expect(localStorage.getItem('carpooling_language')).toBe('en');
  });

  // WCAG 3.1.1: el lector de pantalla lee con la voz del idioma de la página
  it('sets the language of the page', () => {
    setupModule();
    const service = TestBed.inject(LanguageService);
    service.setLanguage('en');
    expect(document.documentElement.lang).toBe('en');
    service.setLanguage('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('toggles language between es and en', () => {
    setupModule();
    const service = TestBed.inject(LanguageService);
    service.setLanguage('es');
    service.toggleLanguage();
    expect(service.currentLanguage()).toBe('en');
    service.toggleLanguage();
    expect(service.currentLanguage()).toBe('es');
  });
});
